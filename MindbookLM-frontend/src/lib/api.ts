const API_KEY = import.meta.env.VITE_API_KEY; // API key from environment variable
const endpoint = import.meta.env.VITE_API_ENDPOINT;

type FetchQueryProps = {
  query: string;
  variables?: any;
  getToken: () => Promise<string>; // Function to get the JWT token 
};

// Helper to decode JWT and get the 'sub' (user ID)
const getUserIdFromToken = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])); // Decode the JWT payload
    return payload?.sub; // Get 'sub' field, which contains the user ID
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

const fetchQuery = async ({ query, variables, getToken }: FetchQueryProps) => {
  if (!getToken) {
    console.error('No auth token getter available');
    return { data: null, error: 'Authentication required' };
  }

  // Get the JWT token
  const token = await getToken();

  if (!token) {
    console.error('No auth token available');
    return { data: null, error: 'Authentication required' };
  }

  const userId = getUserIdFromToken(token);

  if (!userId) {
    console.error('Failed to extract user ID from token');
    return { data: null, error: 'Invalid user ID' };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`, // backend authentication
      },
      body: JSON.stringify({
        query,
        variables: {
          ...variables,
          userId, // Add user ID from the JWT
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const { data, error, errors } = await res.json();
    if (errors) {
      throw new Error(errors[0]?.message || 'GraphQL error occurred');
    }
    return { data, error: error || errors };
  } catch (err) {
    console.error("Error in fetchQuery:", err);
    return { data: null, error: err };
  }
};

export async function querySystem(message: string, getToken: () => Promise<string>) {
  const graphqlQuery = `
    query QuerySystem($question: String!, $userId: String!) {
      querySystem(question: $question, userId: $userId)
    }
  `;

  const { error, data } = await fetchQuery({
    query: graphqlQuery,
    variables: { question: message },
    getToken,
  });

  if (error) {
    console.log("API Error:", error);
    return { error: Array.isArray(error) ? error[0] : error };
  } else {
    console.log("API Response:", data);
    return { data };
  }
}

export async function addNote(text: string, getToken: () => Promise<string>) {
  const graphqlQuery = `
    mutation($o_text: String!, $userId: String!) {
      addNote(o_text: $o_text, userId: $userId)
    }
  `;

  const { error, data } = await fetchQuery({
    query: graphqlQuery,
    variables: { o_text: text },
    getToken,
  });

  if (error) {
    console.log("Add Note Error:", error);
    return { error: Array.isArray(error) ? error[0] : error };
  } else {
    console.log("Add Note Response:", data);
    return { data };
  }
}
