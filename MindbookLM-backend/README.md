
MindbookLM basically has two modes of interaction: **Inject Memory Mode** and **Chat Mode**. Each mode has distinct functions that facilitate efficient note management and querying.

## 1. Inject Memory Mode

### Important Functions:

- **`generateNoteEmbedding`**: This function generates embeddings for the submitted text, enabling efficient similarity searches and connections between notes. It uses sentence-transformers/all-MiniLM-L6-v2 embedding model configured in the manifest file as minilm. This model basically maps sentences & paragraphs to a 384 dimensional dense vector space which can later be used for tasks like clustering or semantic search. In modus any models or resources your app needs should be first configured in the modus.json file (the manifest file). You can use the models object in the app manifest to easily define models that your app needs.

  ```json
  "models": {
    "minilm": {
      "sourceModel": "sentence-transformers/all-MiniLM-L6-v2",
      "provider": "hugging-face",
      "connection": "hypermode"
    }
  }
  ```

  Since this model is hosted by hypermode itself, we don't need to add any additional connection.  

- **`preprocess_lm`**: This function addresses the challenge of relative date references (e.g., "yesterday" or "next Friday"). It converts these references into absolute dates while maintaining the natural flow of your writing. For example, if you write:  

  > "Yesterday I had a great meeting, and next week we'll follow up"  

  on January 8, 2025, the function will convert this to:  

  > "On January 7, 2025, I had a great meeting, and on January 15, 2025, we'll follow up."  

  This ensures the relevance and accuracy of your notes, even when reviewed at a later date.  

  This function uses a `text-generator2` model configured in the manifest file:  

  ```json
  "models": {
    "text-generator2": {
      "sourceModel": "llama-3.3-70b-versatile",
      "connection": "openai",
      "path": "chat/completions"
    }
  },
  "connections": {
    "openai": {
      "type": "http",
      "baseUrl": "https://api.groq.com/openai/v1/",
      "headers": {
        "Authorization": "Bearer {{API_KEY}}"
      }
    }
  }

With Modus, we can use external models (not hosted by hypermode) by connecting to external endpoints. Since the above model is hosted by Groq, we add an HTTP connection to it to use the `text-generator2` in our functions.  

Modus uses specific naming conventions for secret variables. The convention is `MODUS_<CONNECTION NAME>_<PLACEHOLDER>`. So, in this case, the API key should be configured in the `.env.dev.local` file as `MODUS_OPENAI_API_KEY`. We needed consistent and accurate performance for preprocessing, so I have used this bigger model.  

- **`addNote`**: The `addNote` function orchestrates the entire flow of Inject Mode. When a note is submitted, it is passed through the `preprocess_lm` function to handle relative dates. The system then generates embeddings for the note using `generateNoteEmbedding`. The note is stored in a temporal hierarchy in Neo4j, categorized by year, month, and day. Additionally, the system searches for similar notes using these embeddings. If similar notes are found, relationships are established between them, creating a web of interconnected memories. This mirrors human memory, enabling users to recall related experiences when reviewing a specific note.  

This function interacts with Neo4j, so we need to configure a connection to Neo4j in the manifest.  

```json
"connections": {
  "neo4j": {
    "type": "neo4j",
    "dbUri": "{{NEO4J_URI}}",
    "username": "{{USERNAME}}",
    "password": "{{PASSWORD}}"
  }
}
```

Similarly, as per the naming convention, the environment variables should be:  
- `MODUS_NEO4J_NEO4J_URI`  
- `MODUS_NEO4J_USERNAME`  
- `MODUS_NEO4J_PASSWORD`  

---

## 2. Chat Mode  

### **Important Functions**  

- **`queryDecider`**  
This function analyzes the user's query and determines whether the request is time-based (e.g., "What did I do this day last month?") or topic-based (e.g., "Tell me about my coffee meetings with John").  
It also converts relative dates in the query and decides the most effective search strategy (whether to find notes based on similarity searching or temporal matching). This function uses the same Groq-hosted model configured earlier (`text-generator2`) for decision-making.  

- **`findSimilarNotes`**  
This function performs a similarity search using the vector index in Neo4j. It converts the user's query into an embedding, then finds notes with similar embeddings. The function also retrieves notes related to the similar ones, providing broader context for the query.  

- **`findNotesByTimeConstraints`**  
For time-based queries, this function searches the temporal hierarchy of notes, retrieving entries based on the time constraints identified by `queryDecider`. Both this function and `findSimilarNotes` utilize the Neo4j connection configured earlier in the manifest.  

- **`getAssistantAnswer`**  
This function takes the retrieved information and crafts a coherent, natural response to the user's query. The assistant is a `text-generator` model configured in the manifest file.  

```json
"models": {
  "text-generator": {
    "sourceModel": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "provider": "hugging-face",
    "connection": "hypermode"
  }
}
```
Since this model is hosted by Hypemode itself, we don't need to add any additional connection.

- **`querySystem`**: The `querySystem` function orchestrates the entire flow of Chat Mode. It coordinates the various functions to process the user's query and generate a meaningful response. It begins by determining the query's intent through `queryDecider`, then routes the query to either similarity-based or temporal searches. Once the relevant notes are retrieved, it passes the information to `getAssistantAnswer` to generate a final response.