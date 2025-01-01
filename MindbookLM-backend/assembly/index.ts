// index.ts
import { neo4j } from "@hypermode/modus-sdk-as";
import { models } from "@hypermode/modus-sdk-as";
import { EmbeddingsModel } from "@hypermode/modus-sdk-as/models/experimental/embeddings";
import { Note, NoteResult } from "./classes";
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
export function addNote(o_text: string): Note {
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

  // Split the query into two parts - first create the note
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
    
    // Return the created note
    RETURN n {
      .text,
      .embedding,
      .dayName
    } as note
  `;

  // Second query to create relationships (optional)
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
  
  // Create the note first
  const createResult = neo4j.executeQuery(hostName, createNoteQuery, vars);
  const noteData = JSON.parse<Note>(createResult.Records[0].get("note"));
  
  // Try to create relationships, but ignore any failures
  neo4j.executeQuery(hostName, createRelationshipsQuery, vars);
  
  // Return the note regardless of relationship creation success
  return new Note(
    noteData.text,
    noteData.embedding,
    noteData.dayName
  );
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
    // First find the top similar notes
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $threshold
    
    // Match temporal path for similar notes
    MATCH (y:Year)-[:MONTH]->(m:Month)-[:DAY]->(d:Day)-[:NOTE]->(similarNote)
    
    // Collect similar notes to use for filtering
    WITH collect(similarNote) as similarNotes, similarNote, score
    
    // Get related notes for each similar note
    OPTIONAL MATCH (similarNote)-[:RELATED_TO]->(relatedNote:Note)
    WHERE NOT relatedNote IN similarNotes
    
    // Group results and collect unique related notes
    WITH 
      similarNote,
      score,
      collect(DISTINCT relatedNote) as relatedNotes,
      similarNotes
    
    // Return results with filtered related notes
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
    
    const note = new Note(
      rawResult.note.text,
      rawResult.note.embedding,
      rawResult.note.dayName
    );
    
    return new NoteResult(
      note,
      rawResult.score,
      rawResult.relatedNotes
    );
  });
}
export function deleteAllData(confirmation: string): string {
  // Check if confirmation matches the required string
  if (confirmation.toLowerCase() !== "delete") {
    return "Operation cancelled. Please pass 'delete' to confirm data deletion.";
  }
  
  const vars = new neo4j.Variables();
  
  // Query to delete all nodes and relationships
  const query = `
    MATCH (n)
    DETACH DELETE n
  `;

    // Execute the delete query
    const result = neo4j.executeQuery(hostName, query, vars);
    
    // Drop the vector index if it exists
    const dropIndexQuery = `
      DROP INDEX note_embeddings_index IF EXISTS
    `;
    neo4j.executeQuery(hostName, dropIndexQuery, vars);
    
    return "success";
}

export function preprocess_lm(text: string, isQuery: boolean = false): string {
  const timestamp = Date.now();
  
  //  current date components
  const now = new Date(timestamp);
  
  let instruction: string;
  
  if (isQuery) {
    instruction = `Current date is ${now}.
    Convert any relative date references (today, tomorrow, next week, etc.) in this query to actual dates. If there is nothing relative, ignore the date provided, and just provide the query as it is.
    Original query: "${text}"
    Only output the converted query with no explanations or additional text.`;
  } else {
    instruction = `Current date is ${now} 
    1. Convert any relative date references (today, tomorrow, next week, etc.) in this text to their actual dates.
    2. Add 'on [date] ' where appropriate but don't change any other information like the actual text.
    
    Original text: "${text}"
    Only output the converted text with NO EXPLANATION or additional text.`;
  }

    // Create the model input
    const model = models.getModel<OpenAIChatModel>("text-generator2");
    const input = model.createInput([
      new SystemMessage(instruction),
      new UserMessage(text)
    ]);

    input.temperature = 0.7;
    const output = model.invoke(input);
    return output.choices[0].message.content.trim();
}
/**
 * Handles querying the system and getting AI-assisted responses
 */

export function querySystem(question: string): string {
  const processedQuestion = preprocess_lm(question, true);
  
  // Find similar notes and their related notes
  const notes = findSimilarNotes(processedQuestion);
  
  // Extract all context including both similar and related notes
  const contextTexts = notes.map<string>((result) => {
    // Start with the main similar note
    let noteContext = result.note.text;
    
    // Add related notes if they exist
    if (result.relatedNotes && result.relatedNotes.length > 0) {
      noteContext += "\n\nRelated context:\n" + result.relatedNotes.join("\n");
    }
    
    return noteContext;
  });
  
  // Get AI-assisted answer using the expanded context
  return getAssistantAnswer(processedQuestion, contextTexts);
}

/**
 * Gets an AI-assisted answer based on the question and relevant context
 */
export function getAssistantAnswer(question: string, contextTexts: string[]): string {
  const combinedContext = contextTexts.join("\n\n---\n\n");  // Added separator for clarity

  const systemPrompt = `You are a personal AI assistant with access to the user's stored memories and notes.
Your task is to answer the user's question based on the context provided from their stored notes.
The context includes both directly relevant notes and related memories that might provide additional context.
Only use information from the provided context to answer. If you can't find relevant information in the context,
let the user know that you don't have any stored memories about that topic.
Respond with something like 'yes i remember that' or 'no i don't remember you telling me that...' if possible or necessary.
Be as friendly as possible and try to make connections between related pieces of information when relevant.`;

  // Create the user prompt combining question and context
  const userPrompt = `Context from your memory (including related memories):
${combinedContext}

Question: ${question}

Please answer based on the stored memories above, making connections between related information when relevant.`;

  // Get the model and create input
  const model = models.getModel<OpenAIChatModel>("text-generator");
  const input = model.createInput([
    new SystemMessage(systemPrompt),
    new UserMessage(userPrompt)
  ]);

  // Set parameters
  input.temperature = 0.7;

  // Get the response
  const output = model.invoke(input);
  return output.choices[0].message.content;
}