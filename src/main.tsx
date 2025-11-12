import type { FormEvent } from "react";
import { useState } from "react";
import { Loader, Placeholder } from "@aws-amplify/ui-react";
import "./App.css";
import { Amplify } from "aws-amplify";
import type { Schema } from "../amplify/data/resource";
import outputs from "../amplify_outputs.json";
import { generateClient } from "aws-amplify/data";
import "@aws-amplify/ui-react/styles.css";
import { createRoot } from "react-dom/client";

// configure Amplify (cast to any so a minimal JSON won't break TS)
-Amplify.configure(outputs as any);
// Ensure the configuration includes GraphQL provider keys expected by generateClient()
const safeOutputs: any = { ...(outputs as any) };
if (!safeOutputs.graphqlEndpoint) {
  safeOutputs.graphqlEndpoint =
    process.env.VITE_GRAPHQL_ENDPOINT ||
    "https://example.appsync-api.us-east-1.amazonaws.com/graphql";
}
if (!safeOutputs.graphqlRegion) {
  safeOutputs.graphqlRegion =
    process.env.VITE_GRAPHQL_REGION || safeOutputs.aws_project_region || "us-east-1";
}
// add legacy AppSync keys some Amplify packages still expect
safeOutputs.aws_appsync_graphqlEndpoint = safeOutputs.aws_appsync_graphqlEndpoint || safeOutputs.graphqlEndpoint;
safeOutputs.aws_appsync_region = safeOutputs.aws_appsync_region || safeOutputs.graphqlRegion;

Amplify.configure(safeOutputs as any);

const amplifyClient = generateClient<Schema>({
  authMode: "userPool",
});

function App() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(event.currentTarget);
      const { data, errors } = await amplifyClient.queries.askBedrock({
        ingredients: [formData.get("ingredients")?.toString() || ""],
      });
      if (!errors) {
        // handle both JSON-text and raw string responses
        if (typeof data?.body === "string") {
          try {
            const parsed = JSON.parse(data.body);
            setResult(parsed?.text ?? JSON.stringify(parsed));
          } catch {
            setResult(data.body);
          }
        } else {
          setResult(JSON.stringify(data?.body) || "No data returned");
        }
      } else {
        console.error(errors);
      }
    } catch (e) {
      alert(`An error occurred: ${e}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="app-container">
      <div className="header-container">
        <h1 className="main-header">
          Meet Your Personal
          <br />
          <span className="highlight">Recipe AI</span>
        </h1>
        <p className="description">
          Simply type a few ingredients using the format ingredient1,
          ingredient2, etc., and Recipe AI will generate an all-new
          recipe on demand...
        </p>
      </div>
      <form onSubmit={onSubmit} className="form-container">
        <div className="search-container">
          <input
            type="text"
            className="wide-input"
            id="ingredients"
            name="ingredients"
            placeholder="Ingredient1, Ingredient2, Ingredient3,...etc"
          />
          <button type="submit" className="search-button">
            Generate
          </button>
        </div>
      </form>
      <div className="result-container">
        {loading ? (
          <div className="loader-container">
            <p>Loading...</p>
            <Loader size="large" />
            <Placeholder size="large" />
            <Placeholder size="large" />
            <Placeholder size="large" />
          </div>
        ) : (
          result && <p className="result">{result}</p>
        )}
      </div>
    </div>
  );
}
export default App;

// Render the app into #root (Vite template usually includes this element)
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root container not found. Ensure your index.html has a <div id="root"></div>');
}