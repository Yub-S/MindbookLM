
// index.ts
import { neo4j } from "@hypermode/modus-sdk-as";
import { models } from "@hypermode/modus-sdk-as";
import { EmbeddingsModel } from "@hypermode/modus-sdk-as/models/experimental/embeddings";
import { Note, NoteResult } from "./classes";
import { JSON } from "json-as";

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
 * Add a new note to the database with temporal hierarchy and semantic relationships
 */
export function addNote(text: string): Note {
  // Generate embedding for the note
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  const timestamp = Date.now();
  
  // Get current date components
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
  vars.set("timestamp", timestamp);

  // Create vector index if it doesn't exist
  const indexQuery = `
    CREATE VECTOR INDEX note_embeddings_index 
    IF NOT EXISTS FOR (n:Note) ON (n.embedding)
  `;

  // Modified query to properly handle day number and name
  const query = `
    // Create year node
    MERGE (y:Year {year: $year})
    
    // Create month node
    MERGE (y)-[:MONTH]->(m:Month {name: $month})
    
    // Create date node (for numerical day)
    MERGE (m)-[:DATE]->(date:Date {day: $dayNumber})
    
    // Create day node (for day name)
    MERGE (date)-[:DAY]->(d:Day {name: $dayName})
    
    // Create the note
    CREATE (n:Note {
      text: $text,
      embedding: $embedding
    })
    
    // Connect note to day
    MERGE (d)-[:NOTE]->(n)
    
    RETURN n
  `;

  const result = neo4j.executeQuery(hostName, query, vars);
  neo4j.executeQuery(hostName, indexQuery);
  
  const noteData = JSON.parse<Note>(result.Records[0].get("n"));
  
  // Create and return a new Note instance with the actual data
  return new Note(
    noteData.text,
    noteData.embedding
  );
}
/**
 * Find similar notes based on semantic search
 */
export function findSimilarNotes(text: string, threshold: f32 = 0.8): NoteResult[] {
  const embedding = generateNoteEmbedding(text);
  
  const vars = new neo4j.Variables();
  vars.set("embedding", embedding);
  vars.set("threshold", threshold);

  const query = `
    CALL db.index.vector.queryNodes('note_embeddings_index', 10, $embedding)
    YIELD node AS similarNote, score
    WHERE score >= $threshold
    
    MATCH (y:Year)-[:HAS_MONTH]->(m:Month)-[:HAS_DAY]->(d:Day)-[:HAS_NOTE]->(similarNote)
    
    OPTIONAL MATCH (similarNote)-[r:RELATED_TO]-(relatedNote)
    WHERE r.score >= $threshold
    
    WITH similarNote, score,
         COLLECT(DISTINCT relatedNote) AS relatedNotes
    
    RETURN {
      note: similarNote,
      score: score,
      relatedNotes: relatedNotes
    } AS result
    ORDER BY score DESC
  `;

  const result = neo4j.executeQuery(hostName, query, vars);
  return result.Records.map<NoteResult>((record) => {
    const parsed = JSON.parse<NoteResult>(record.get("result"));
    return new NoteResult(
      parsed.note,
      parsed.score,
      parsed.relatedNotes
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