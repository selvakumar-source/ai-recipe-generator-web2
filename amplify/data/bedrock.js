import { defineBackend } from "@aws-amplify/backend";
import { data } from "./data/resource";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";

const backend = defineBackend({
  auth,
  data,
});

const bedrockDataSource = backend.data.resources.graphqlApi.addHttpDataSource(
  "bedrockDS",
  "https://bedrock-runtime.us-east-1.amazonaws.com",
  {
    authorizationConfig: {
      signingRegion: "us-east-1",
      signingServiceName: "bedrock",
    },
  }
);

bedrockDataSource.grantPrincipal.addToPrincipalPolicy(
  new PolicyStatement({
    // broaden account wildcard to avoid ARN/account mismatch during deploy
    resources: ["arn:aws:bedrock:us-east-1:*:foundation-model/*"],
    actions: ["bedrock:InvokeModel"],
  })
);

export function request(ctx) {
  const { ingredients = [] } = ctx.args;

  // Construct the prompt with the provided ingredients
  const prompt = `Suggest a recipe idea using these ingredients: ${ingredients.join(", ")}.`;

  // Use the model invocation path without the trailing ":0" and send a simple input payload
  return {
    resourcePath: `/model/anthropic.claude-3-sonnet-20240229-v1/invoke`,
    method: "POST",
    params: {
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Bedrock models accept different payload shapes; 'input' is broadly compatible.
        input: prompt,
        maxTokens: 1000,
        temperature: 0.7,
      }),
    },
  };
}

export function response(ctx) {
  // Parse the response body safely and support multiple possible Bedrock response shapes.
  let parsedBody;
  try {
    parsedBody = JSON.parse(ctx.result.body);
  } catch (e) {
    const raw = ctx.result.body || "";
    // return JSON if GraphQL expects an object, otherwise leave as string
    return { body: JSON.stringify({ text: raw }) };
  }

  let text = "";

  if (parsedBody?.output?.[0]?.content?.[0]?.text) {
    text = parsedBody.output[0].content[0].text;
  } else if (parsedBody?.results?.[0]?.output?.[0]?.content?.[0]?.text) {
    text = parsedBody.results[0].output[0].content[0].text;
  } else if (parsedBody?.content?.[0]?.text) {
    text = parsedBody.content[0].text;
  } else if (typeof parsedBody === "string") {
    text = parsedBody;
  } else {
    text = JSON.stringify(parsedBody);
  }

  // return a JSON object so GraphQL consumers can access .text (change if your schema expects a raw string)
  return { body: JSON.stringify({ text }) };
}