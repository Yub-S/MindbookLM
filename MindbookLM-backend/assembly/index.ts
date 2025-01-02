import { neo4j } from "@hypermode/modus-sdk-as";
import { models } from "@hypermode/modus-sdk-as";
import { EmbeddingsModel } from "@hypermode/modus-sdk-as/models/experimental/embeddings";
import { Note, NoteResult, QueryDecision, TimeConstraints } from "./classes";
import { JSON } from "json-as";
import {
  OpenAIChatModel,
  ResponseFormat,
  SystemMessage,
  UserMessage,
} from "@hypermode/modus-sdk-as/models/openai/chat"

const hostName = "neo4j";

/**
 * Generate embeddings for an array of texts using the minilm model
 */
export function generateEmbeddings(texts: string[]): f32[][] {
  const model = models.getModel<EmbeddingsModel>("minilm");
  const input = model.createInput(texts);
  const output = model.invoke(input);
  return output.predictions;
}

/**
 * Create embedding for a single note text
 */
export function generateNoteEmbedding(text: string): f32[] {
  return generateEmbeddings([text])[0];
}

/**
 * Add a new note to the database 
 */
export function addNote(o_text: string): string {
  const text = preprocess_lm(o_text);
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  const timestamp = Date.now();
  
  // Current date components
  const now = new Date(timestamp);
  const year = now.getUTCFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", 
    "Thursday", "Friday", "Saturday"
  ];
  const month = monthNames[now.getUTCMonth()];
  const dayNumber = now.getUTCDate();
  const dayName = dayNames[now.getUTCDay()];
  
  vars.set("text", text);
  vars.set("embedding", embedding);
  vars.set("year", year);
  vars.set("month", month);
  vars.set("dayNumber", dayNumber);
  vars.set("dayName", dayName);
  vars.set("similarityThreshold", 0.7);

  // Create vector index if it doesn't exist
  const indexQuery = `
    CREATE VECTOR INDEX note_embeddings_index 
    IF NOT EXISTS FOR (n:Note) ON (n.embedding)
  `;

  const createNoteQuery = `
    // Create temporal hierarchy
    MERGE (y:Year {year: $year})
    MERGE (y)-[:MONTH]->(m:Month {month: $month})
    MERGE (m)-[:DAY]->(d:Day {value: $dayNumber})
    
    // Create new note
    CREATE (n:Note {
      text: $text,
      embedding: $embedding,
      dayName: $dayName
    })
    
    // Connect to temporal hierarchy
    MERGE (d)-[:NOTE]->(n)
    
    // Return success message
    RETURN 'Note successfully created and connected to temporal hierarchy' as message
  `;

  const createRelationshipsQuery = `
    MATCH (n:Note {text: $text})
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $similarityThreshold 
    AND similarNote <> n
    
    // Create relationships
    MERGE (n)-[r:RELATED_TO]->(similarNote)
    SET r.similarity_score = score
  `;

  // Execute queries in sequence
  neo4j.executeQuery(hostName, indexQuery);
  
  const createResult = neo4j.executeQuery(hostName, createNoteQuery, vars);
  const successMessage = createResult.Records[0].get("message");
  
  neo4j.executeQuery(hostName, createRelationshipsQuery, vars);
  
  return successMessage;
}

/**
 * Find similar notes based on semantic search
 */
export function findSimilarNotes(text: string, threshold: f32 = 0.6): NoteResult[] {
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  vars.set("embedding", embedding);
  vars.set("threshold", threshold);

  const query = `
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $threshold
    
    MATCH (y:Year)-[:MONTH]->(m:Month)-[:DAY]->(d:Day)-[:NOTE]->(similarNote)
    
    WITH collect(similarNote) as similarNotes, similarNote, score
    
    OPTIONAL MATCH (similarNote)-[:RELATED_TO]->(relatedNote:Note)
    WHERE NOT relatedNote IN similarNotes
    
    WITH 
      similarNote,
      score,
      collect(DISTINCT relatedNote) as relatedNotes,
      similarNotes
    
    RETURN {
      note: {
        text: similarNote.text,
        embedding: similarNote.embedding,
        dayName: similarNote.dayName
      },
      score: score,
      relatedNotes: [
        note IN relatedNotes 
        WHERE note IS NOT NULL |
        note.text
      ]
    } as result
    ORDER BY result.score DESC
  `;

  const result = neo4j.executeQuery(hostName, query, vars);
  
  return result.Records.map<NoteResult>((record) => {
    const rawResult = JSON.parse<NoteResult>(record.get("result"));
    return rawResult;
  });
}

export function queryDecider(query: string): QueryDecision {
  const timestamp = Date.now();
  const now = new Date(timestamp);
  const systemPrompt = `Current date is ${now}.

  You are a query analyzer for a note-taking system. The system has two ways to find relevant notes:

  1. Temporal Matching (queryType: "general"):
    - Database structure: Year->Month->Day->Note
    - Used when query mentions or implies a specific time
    - Examples: "what did I do yesterday", "how was January", "notes from 2024"
    - Must provide exact temporal values for matching the hierarchy

  2. Similarity Search (queryType: "similarity"):
    - Searches through note texts for similar content
    - Used when looking for topics/content without time reference
    - Examples: "anything about khalti?", "what did I write about AI"

  Your task:
  1. convert any relative dates (yester, last month, last year, today, tomorrow, next week or so) in this query to actual dates
  1. Analyze if the query needs temporal matching or similarity search
  3. Set timeConstraints based on query type:

  timeConstraints format:
  {
    "year": "YYYY" or null (null if similarity search or if year not needed for temporal search)
    "month": "Month" or null (null if similarity search or if month not needed for temporal search)
    "day": "DD" or null (null if similarity search or if day not needed for temporal search)
  }

  Examples:

  1. Temporal query (full date):
  {
    "processedQuery": "what happened on January 1, 2025",
    "queryType": "general",
    "timeConstraints": {
      "year": "2025",
      "month": "January",
      "day": "1"
    }
  }

  2. Temporal query (yesterday):
  {
    "processedQuery": "how was January 1, 2025", 
    "queryType": "general",
    "timeConstraints": {
      "year": "2025",
      "month": "January", 
      "day": "1"
    }
  }

  3. Temporal query (just month):
  {
    "processedQuery": "what happened in January 2025",
    "queryType": "general", 
    "timeConstraints": {
      "year": 2025,
      "month": "January",
      "day": null
    }
  }

  4. Content search:
  {
    "processedQuery": "anything about khalti ceo",
    "queryType": "similarity",
    "timeConstraints": {
      "year": null,
      "month": null,
      "day": null
    }
  }

  Remember:
  - If query needs to search through note contents → use similarity search
  - If query mentions or implies time → use temporal matching with exact date values
  - For temporal queries, only include the time components that are actually needed for searching
  - only ouptput the decision object with no explanations or additional text.
  - processed query text in both cases should have exact dates instead of refereces without any additional text.
  
  - for query related to notes that refer to future dates(today,tomorrow,next week,next month or so, convert the query into actual dates) and then, just use the similarity search with timeconstraints null. `;

  const model = models.getModel<OpenAIChatModel>("text-generator2");
  const input = model.createInput([
    new SystemMessage(systemPrompt),
    new UserMessage(query)
  ]);

  input.temperature = 0.1;
  const output = model.invoke(input);
  const result = JSON.parse<QueryDecision>(output.choices[0].message.content);
  return result;
  }

export function findNotesByTimeConstraints(timeConstraints: TimeConstraints): string[] {
  const vars = new neo4j.Variables();
  
  let query = "MATCH (y:Year)";
  let whereClause = "";
  
  if (timeConstraints.year !== null) {
    const yearValue = parseInt(timeConstraints.year as string);
    vars.set("year", yearValue);
    whereClause += "y.year = $year";
  }
  
  if (timeConstraints.month !== null) {
    query += "-[:MONTH]->(m:Month)";
    vars.set("month", timeConstraints.month);
    whereClause += whereClause ? " AND m.month = $month" : "m.month = $month";
  }
  
  if (timeConstraints.day !== null) {
    query += "-[:DAY]->(d:Day)";
    const dayValue = parseInt(timeConstraints.day as string);
    vars.set("day", dayValue);
    whereClause += whereClause ? " AND d.value = $day" : "d.value = $day";
  }
  
  query += (timeConstraints.day !== null ? "" : "-[:DAY]->(d:Day)") + "-[:NOTE]->(n:Note)";
  
  if (whereClause) {
    query += " WHERE " + whereClause;
  }
  
  query += " RETURN n.text as text";
  
  const result = neo4j.executeQuery(hostName, query, vars);
  return result.Records.map<string>((record) => record.get("text"));
}

export function deleteAllData(confirmation: string): string {
  if (confirmation.toLowerCase() !== "delete") {
    return "Operation cancelled. Please pass 'delete' to confirm data deletion.";
  }
  
  const vars = new neo4j.Variables();
  
  const query = `
    MATCH (n)
    DETACH DELETE n
  `;
  
  const result = neo4j.executeQuery(hostName, query, vars);
  
  const dropIndexQuery = `
    DROP INDEX note_embeddings_index IF EXISTS
  `;
  neo4j.executeQuery(hostName, dropIndexQuery, vars);
  
  return "success";
}

export function preprocess_lm(text: string): string {
  const timestamp = Date.now();
  const now = new Date(timestamp);
  
  let instruction: string;
  
  instruction = `Current date is ${now} 
  1. Convert any relative date references (today, tomorrow, next week, etc.) in this text to their actual dates.
  2. Add 'on [date] ' where appropriate but don't change any other information like the actual text.
  
  Original text: "${text}"
  Only output the converted text with NO EXPLANATION or additional text.`;
  
  const model = models.getModel<OpenAIChatModel>("text-generator2");
  const input = model.createInput([
    new SystemMessage(instruction),
    new UserMessage(text)
  ]);

  input.temperature = 0.7;
  const output = model.invoke(input);
  return output.choices[0].message.content.trim();
}

export function querySystem(question: string): string {
  const decision = queryDecider(question);
  
  let contextTexts: string[];
  
  if (decision.queryType === "general") {
    contextTexts = findNotesByTimeConstraints(decision.timeConstraints);
  } else {
    const notes = findSimilarNotes(decision.processedQuery);
    contextTexts = notes.map<string>((result) => {
      let noteContext = result.note.text;
      if (result.relatedNotes && result.relatedNotes.length > 0) {
        noteContext += "\n\nRelated context:\n" + result.relatedNotes.join("\n");
      }
      return noteContext;
    });
  }
  
  return getAssistantAnswer(decision.processedQuery, contextTexts);
}

export function getAssistantAnswer(question: string, contextTexts: string[]): string {
  const combinedContext = contextTexts.join("\n\n---\n\n");

  const systemPrompt = `You are a personal AI assistant with access to the user's stored memories and notes.
Your task is to answer the user's question based on the context provided from their stored notes. 
try to answer what user is asking, in the same manner user is asking.
The context includes both directly relevant notes and related memories that might provide additional context.
Only use information from the provided context to answer. If you can't find relevant information in the context,
let the user know that you don't have any stored memories about that topic.
Respond with something like 'yes i remember that' or 'no i don't remember you telling me that...' if possible or necessary.
Be as friendly as possible and try to make connections between related pieces of information when relevant.`;

  const userPrompt = `Context from your memory (including related memories):
${combinedContext}

Question: ${question}

Please answer based on the stored memories above, making connections between related information when relevant.`;

  const model = models.getModel<OpenAIChatModel>("text-generator2");
  const input = model.createInput([
    new SystemMessage(systemPrompt),
    new UserMessage(userPrompt)
  ]);

  input.temperature = 0.7;
  const output = model.invoke(input);
  return output.choices[0].message.content;
}