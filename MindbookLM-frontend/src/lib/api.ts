type FetchQueryProps = {
    query: string
    variables?: any
  }
  
  const fetchQuery = async ({ query, variables }: FetchQueryProps) => {
    try {
      const res = await fetch('http://localhost:8686/graphql', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        cache: "no-store",
      })
      
      if (res.status < 200 || res.status >= 300) {
        throw new Error(res.statusText)
      }
      
      const { data, error, errors } = await res.json()
      return { data, error: error || errors }
    } catch (err) {
      console.error("error in fetchQuery:", err)
      return { data: null, error: err }
    }
  }
  
  export async function querySystem(message: string) {
    const graphqlQuery = `
      query QuerySystem($question: String!) {
        querySystem(question: $question)
      }
    `
    
    const { error, data } = await fetchQuery({
      query: graphqlQuery,
      variables: { question: message },
    })
  
    if (error) {
      console.log("API Error:", error)
      return { error: Array.isArray(error) ? error[0] : error }
    } else {
      console.log("API Response:", data)
      return { data }
    }
  }
  
  export async function addNote(text: string) {
    const graphqlQuery = `
      mutation($o_text: String!) {
        addNote(o_text: $o_text)
      }
    `
    
    const { error, data } = await fetchQuery({
      query: graphqlQuery,
      variables: { o_text: text },  // o_text is the variable name in the mutation
    })
  
    if (error) {
      console.log("Add Note Error:", error)
      return { error: Array.isArray(error) ? error[0] : error }
    } else {
      console.log("Add Note Response:", data)
      return { data }
    }
  }