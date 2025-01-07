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
export function addNote(o_text: string, userId: string): string {
  const text = preprocess_lm(o_text);
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  const timestamp = Date.now();
  
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
  vars.set("userId", userId);

  // Create vector index if it doesn't exist
  const indexQuery = `
    CREATE VECTOR INDEX note_embeddings_index 
    IF NOT EXISTS FOR (n:Note) ON (n.embedding)
  `;

  // Create user node and temporal hierarchy under it
  const createNoteQuery = `
    // Ensure user exists
    MERGE (u:User {id: $userId})
    
    // Create temporal hierarchy under user
    MERGE (u)-[:HAS_YEAR]->(y:Year {year: $year})
    MERGE (y)-[:HAS_MONTH]->(m:Month {month: $month})
    MERGE (m)-[:HAS_DAY]->(d:Day {value: $dayNumber})
    
    // Create new note
    CREATE (n:Note {
      text: $text,
      embedding: $embedding,
      dayName: $dayName
    })
    
    // Connect to temporal hierarchy
    MERGE (d)-[:HAS_NOTE]->(n)
    
    RETURN 'Note successfully created and connected to temporal hierarchy' as message
  `;

  // Find relationships between notes under the same user
  const createRelationshipsQuery = `
    MATCH (u:User {id: $userId})-[:HAS_YEAR]->(:Year)-[:HAS_MONTH]->(:Month)-[:HAS_DAY]->(:Day)-[:HAS_NOTE]->(n:Note {text: $text})
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $similarityThreshold 
    AND similarNote <> n
    AND EXISTS((u)-[:HAS_YEAR]->(:Year)-[:HAS_MONTH]->(:Month)-[:HAS_DAY]->(:Day)-[:HAS_NOTE]->(similarNote))
    
    MERGE (n)-[r:RELATED_TO]->(similarNote)
    SET r.similarity_score = score
  `;

  neo4j.executeQuery(hostName, indexQuery);
  const createResult = neo4j.executeQuery(hostName, createNoteQuery, vars);
  const successMessage = createResult.Records[0].get("message");
  neo4j.executeQuery(hostName, createRelationshipsQuery, vars);
  
  return successMessage;
}

export function findSimilarNotes(text: string, userId: string, threshold: f32 = 0.6): NoteResult[] {
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  vars.set("embedding", embedding);
  vars.set("threshold", threshold);
  vars.set("userId", userId);

  const query = `
MATCH (u:User {id: $userId})
CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
YIELD node AS similarNote, score
WHERE score >= $threshold

// Ensure note is in user's hierarchy
MATCH (u)-[:HAS_YEAR]->(:Year)-[:HAS_MONTH]->(:Month)-[:HAS_DAY]->(:Day)-[:HAS_NOTE]->(similarNote)

WITH similarNote, score
OPTIONAL MATCH (similarNote)-[:RELATED_TO]-(relatedNote:Note)

// Group related notes and pass through other fields
WITH similarNote.text AS noteText, 
     similarNote.embedding AS noteEmbedding, 
     similarNote.dayName AS noteDayName, 
     score, 
     collect(DISTINCT relatedNote.text) AS relatedNotes

RETURN {
  note: {
    text: noteText,
    embedding: noteEmbedding,
    dayName: noteDayName
  },
  score: score,
  relatedNotes: relatedNotes
} AS result
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
  1. convert any relative dates (yesterday, last month, last year, today, tomorrow, next week or similar others) in this query to actual dates
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

  3. Content search:
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

export function findNotesByTimeConstraints(timeConstraints: TimeConstraints, userId: string): string[] {
  const vars = new neo4j.Variables();
  vars.set("userId", userId);

  let query = `
    MATCH (u:User {id: $userId})-[:HAS_YEAR]->(y:Year)
  `;

  let whereClause = "";
  
  if (timeConstraints.year !== null) {
    vars.set("year", parseInt(timeConstraints.year as string));
    whereClause += "y.year = $year";
    query += "-[:HAS_MONTH]->(m:Month)";
  }
  
  if (timeConstraints.month !== null) {
    vars.set("month", timeConstraints.month);
    whereClause += (whereClause ? " AND " : "") + "m.month = $month";
    query += "-[:HAS_DAY]->(d:Day)";
  }
  
  if (timeConstraints.day !== null) {
    vars.set("day", parseInt(timeConstraints.day as string));
    whereClause += (whereClause ? " AND " : "") + "d.value = $day";
  }

  query += (timeConstraints.day !== null ? "" : "-[:HAS_DAY]->(d:Day)") + "-[:HAS_NOTE]->(n:Note)";
  
  if (whereClause) {
    query += ` WHERE ${whereClause}`;
  }

  query += " RETURN n.text as text";

  console.log(`Executing query: ${query}`);
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
"Convert any/all the relative date references (e.g., 'next Monday', 'yesterday', 'last Sunday', 'last month', 'last year') into the actual date format (e.g., 'January 12, 2025'), while ensuring the sentence sounds natural and maintains the same meaning. Keep the user's original phrasing, spelling, and style exactly as it is, only replacing relative date references with the correct absolute dates. For past references like 'yesterday' or 'last Sunday', ensure that the date reflects the actual day in the past. For future references like 'next Monday', make sure the conversion matches the actual date based on the current date provided. Do not change any other part of the sentence."

  Example input:
  "Yesterday, I had a lot of fun."
  "Next Monday, I have a meeting with my friends."
  "Last Sunday, we went hiking."

  Expected output:
  "yesterday(On January 1, 2025), I had a lot of fun."
  "next monday(On January 12, 2025), I have a meeting with my friends."
  "last sunday(On December 28, 2024), we went hiking."
  
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

export function querySystem(question: string, userId: string): string {
  const decision = queryDecider(question);
  let contextTexts: string[] = [];
  console.log(userId);
  
  if (decision.queryType === "general") {
    const temporalResults = findNotesByTimeConstraints(decision.timeConstraints, userId);
    
    if (temporalResults.length > 0) {
      contextTexts = temporalResults;
    } else {
      const notes = findSimilarNotes(decision.processedQuery, userId);
      contextTexts = notes.map<string>((result) => {
        let noteContext = result.note.text;
        if (result.relatedNotes && result.relatedNotes.length > 0) {
          noteContext += "\n\nRelated context:\n" + result.relatedNotes.join("\n");
        }
        return noteContext;
      });
    }
  } else {
    const notes = findSimilarNotes(decision.processedQuery, userId);
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
  console.log(combinedContext)

  const systemPrompt = `You are a personal AI assistant with access to the user's stored memories and notes.
Your task is to answer the user's question based on the context provided from their stored notes. 
The context includes both directly relevant notes and related memories that might provide additional context.
Only use information from the provided context to answer. If you can't find relevant information in the context,
let the user know that you don't have any stored memories about that topic or the user hasn't shared them with you.
Be as friendly as possible . Be precise and concise in your answers.`;

  const userPrompt = `Context from your memory (including related memories):
${combinedContext}

Question: ${question}

Please answer based on the stored memories above.`;

  const model = models.getModel<OpenAIChatModel>("text-generator");
  const input = model.createInput([
    new SystemMessage(systemPrompt),
    new UserMessage(userPrompt)
  ]);

  input.temperature = 0.7;
  const output = model.invoke(input);
  return output.choices[0].message.content;
}