import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import CustomError from './CustomError.mjs';

const REGION = process.env.REGION;

export async function getSecret(secret_id) {
  const secretClient = new SecretsManagerClient({
    REGION: REGION,
  });

  let response;

  try {
    response = await secretClient.send(
      new GetSecretValueCommand({ SecretId: secret_id })
    );
  }
  catch (error) {
    console.log('error get SecretId', error);
    throw new CustomError("error occurred unable to get credentials from secret manager.", {
      name: "getSecret",
      statusCode: 500
    });
  }
  return response.SecretString;
}

export async function generate_out_put_response(
  inputObject,
  message = "",
  status_code = 200,
  additional = {}
) {
  try {
    const isSuccess = status_code >= 200 && status_code < 299;
    const hasData = inputObject && Object.keys(inputObject).length > 0;

    // Extract error type from inputObject if it exists
    let errorType = inputObject && inputObject.name ? { type: inputObject.name } : null;
    
    const responseBody = {
      error: !isSuccess,
      message,
      response: isSuccess && hasData ? inputObject : {},
      statusCode: status_code,
      ...additional
    };

    // For specific error types we want to include in the response
    if (!isSuccess && errorType) {
      responseBody.errorMessage = errorType;
    }

    return {
      statusCode: status_code, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(responseBody)
    };
  } catch (err) {
    console.error("Error in generate_out_put_response:", err);
    throw new CustomError("Failed to generate output response.", {
      name: "generate_out_put_response",
      statusCode: 500
    });
  }
}



export async function generate_response_with_pagination(
  inputObject,
  pagination,
  message = "Query successfully.",
  status_code = 200,
) {
  try {
    let res = {
      message: message,
    };

    res.data = Array.isArray(inputObject) ? inputObject : [inputObject];
    if (Object.keys(inputObject).length == 0) {
      res.data = [];
    }
    res.pagination = pagination;
    return {
      statusCode: status_code,
      body: JSON.stringify(res),

    };
  } catch (err) {
    console.log("error on generate_response_with_pagination : ", err);
    throw new CustomError(
      "error occurred unable to generate response with pagination.",
      {
        name: "generate_response_with_pagination",
        statusCode: 500,
      }
    );
  }
}


