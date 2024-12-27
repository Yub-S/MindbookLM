
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
export function addNote(otext: string): Note {

  const text = preprocess_lm(otext);
  // Generate embedding for the note
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  const timestamp = Date.now();
  
  //  current date components
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

  // Create vector index if it doesn't exist
  const indexQuery = `
    CREATE VECTOR INDEX note_embeddings_index 
    IF NOT EXISTS FOR (n:Note) ON (n.embedding)
  `;

  // Main query to create note and establish relationships
  const query = `
    MERGE (y:Year {year: $year})
    MERGE (y)-[:MONTH]->(m:Month {month: $month})
    MERGE (m)-[:DAY]->(d:Day {value: $dayNumber})
    
    CREATE (n:Note {
      text: $text,
      embedding: $embedding,
      dayName: $dayName
    })
    
    MERGE (d)-[:NOTE]->(n)
    
    RETURN n {
      .text,
      .dayName,
      .embedding
    } as note
  `;

  // Execute queries
  neo4j.executeQuery(hostName, indexQuery);
  const result = neo4j.executeQuery(hostName, query, vars);
  
  
  const noteData = JSON.parse<Note>(result.Records[0].get("note"));
  
  // Create and return a new Note instance with the actual data
  return new Note(
    noteData.text,
    noteData.embedding
  );
}
/**
 * Find similar notes based on semantic search
 */
export function findSimilarNotes(text: string, threshold: f32 = 0.7): NoteResult[] {
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  vars.set("embedding", embedding);
  vars.set("threshold", threshold);

  const query = `
    // Find similar notes using vector search
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $threshold
    
    // Match the path according to our addNote structure
    MATCH (y:Year)-[:MONTH]->(m:Month)-[:DAY]->(d:Day)-[:NOTE]->(similarNote)
    
    // Return note with its metadata
    RETURN {
      note: similarNote {
        .text,
        .embedding
      },
      score: score
    } AS result
    ORDER BY score DESC
  `;

  const result = neo4j.executeQuery(hostName, query, vars);
  
  return result.Records.map<NoteResult>((record) => {
    const parsed = JSON.parse<NoteResult>(record.get("result"));
    return new NoteResult(
      parsed.note,
      parsed.score
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
    const model = models.getModel<OpenAIChatModel>("text-generator");
    const input = model.createInput([
      new SystemMessage(instruction),
      new UserMessage(text)
    ]);

    // Set desired model parameters
    input.temperature = 0.7;

    // Invoke the model
    const output = model.invoke(input);
    
    // Get and clean the response
    return output.choices[0].message.content.trim();
}
/**
 * Handles querying the system and getting AI-assisted responses
 */
export function querySystem(question: string): string {
  // First preprocess the question to handle date references
  const processedQuestion = preprocess_lm(question,true);
  
  // Find similar notes
  const similarNotes = findSimilarNotes(processedQuestion);
  
  // Extract all the note texts to use as context
  const contextTexts = similarNotes.map<string>((result) => result.note.text);
  
  // Get AI-assisted answer using the context
  return getAssistantAnswer(processedQuestion, contextTexts);
}

/**
 * Gets an AI-assisted answer based on the question and relevant context
 */
export function getAssistantAnswer(question: string, contextTexts: string[]): string {
  // Join all context texts with clear separation
  const combinedContext = contextTexts.join("\n\n");
  
  // Create the system prompt
  const systemPrompt = `You are a personal AI assistant with access to the user's stored memories and notes.
Your task is to answer the user's question based on the context provided from their stored notes.
Only use information from the provided context to answer. If you can't find relevant information in the context,
let the user know that you don't have any stored memories about that topic.`;

  // Create the user prompt combining question and context
  const userPrompt = `Context from your memory:
${combinedContext}

Question: ${question}

Please answer based on the stored memories above.`;

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