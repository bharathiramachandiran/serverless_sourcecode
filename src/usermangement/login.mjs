import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import CustomError from "../utils/CustomError.mjs";
import DatabaseConnectionPool from '../utils/ConnectionPool.mjs'
import { generate_out_put_response } from '../utils/commonUtils.mjs';

const dbPool = new DatabaseConnectionPool();
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });
const SCHEMA = process.env.SCHEMA_NAME;
const CLIENT_ID = process.env.CLIENT_ID;
const CLINIC_TABLE_NAME = process.env.CLINIC_TABLE_NAME

export const handler = async (event) => {
  let response = {};
  let status_code = 400;
  let message = "Login failed, Incorrect credentails";

  try {
    let payload = JSON.parse(event.body || "{}");
    const { email, password } = payload;

    if (!email || !password) {
      throw new CustomError("Email and password are required", {
        name: "ValidationError",
        statusCode: 400,
      });
    }

    const cognitoResponse = await loginToCognito(payload);
 
    return generate_out_put_response(
        cognitoResponse,
        "New password required",
        200
    );
    

    const result = await dbPool.transaction(handleUserLogin, payload);
    response = result.response;
    message = result.message;
    status_code = result.status_code;

  } catch (err) {
    console.error("Login error:", err);
    if (err instanceof CustomError) {
      status_code = err.statusCode;
      message = err.message;
      response = err
    } else {
      message = err.message || "Internal Server Error";
    }
  }
  return generate_out_put_response(response, message, status_code);
};



async function handleUserLogin(client, payload) {

  const check_result = await checkStatus(client, payload.email);
  if (check_result.rows[0].status != "verified") {
    throw new CustomError("User not verified", {
      name: "UserNotVerified",
      statusCode: 404
    })
  }

  const response = await loginToCognito(payload);

  return {
    message: "Login successful",
    response: response,
    statusCode: 200,
  };

  
}
async function checkStatus(client, email) {
  try {
    const query = {
      text: `SELECT status FROM ${SCHEMA}.${CLINIC_TABLE_NAME} WHERE email = $1`,
      values: [email]
    };
    const result = await client.query(query);
    if(result.rowCount === 0){
      throw new CustomError('Invalid username or password')
    }
    return result
  } catch (error) {
    throw new CustomError(error.message)
  }
}

async function loginToCognito(payload) {
  try {
    const command = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: payload.email,
        PASSWORD: payload.password
      }
    });

    const response = await cognitoClient.send(command);

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      }
    }

    const auth = response.AuthenticationResult;

    return { 
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn
    };

  } catch (err) {
    let statusCode = 400;
    let message = err.message || "Authentication failed";

    if (err.__type === "UserNotFoundException") {
      message = "User does not exist.";
    } else if (err.__type === "NotAuthorizedException") {
      message = "Incorrect username or password.";
    } else {
      statusCode = 500;
    }

    throw new CustomError(message, {
      name: "CognitoLoginFailed",
      statusCode,
    });
  }
}