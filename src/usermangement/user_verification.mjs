import CustomError from '../utils/CustomError.mjs';
import { generate_out_put_response } from '../utils/commonUtils.mjs';
import { payload_validations } from '../utils/process_validation.mjs';
import DatabaseConnectionPool from '../utils/ConnectionPool.mjs';
import { USER_VERIFICATION } from './schema_config.mjs';

import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const dbPool = new DatabaseConnectionPool();

const CLIENT_ID = process.env.CLIENT_ID
const USER_POOL_ID = process.env.USER_POOL_ID
const SCHEMA = process.env.SCHEMA_NAME
const USER_DETAILS_TABLE_NAME = process.env.USER_DETAILS_TABLE_NAME
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const TENANTS_TABLE_NAME = process.env.TENANTS_TABLE_NAME
const USER_CONTACTS_TABLE_NAME = process.env.USER_CONTACTS_TABLE_NAME

const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-south-1' });

export const handler = async (event) => {
  let response = {};
  let message = "Error occurred, unable to register the user";
  let status_code = 400;

  try {
    const payload = JSON.parse(event.body || "{}");

    if (Object.keys(payload).length === 0) {
      throw new CustomError("Bad Request: No payload", { status_code: 400 });
    }

    payload_validations(USER_VERIFICATION, payload);

    const result = await dbPool.transaction(handleUserVerification, payload);

    response = result.response;
    message = result.message;
    status_code = result.status_code;

  } catch (err) {
    console.log("Error occurred in user verification:", err);
    message = err.message;
    status_code = 500;

    if (err instanceof CustomError) {
      status_code = err.statusCode;
      response = err;
    }
  } finally {
    return generate_out_put_response(response, message, status_code);
  }
};

async function handleUserVerification(client, payload) {
  const user_status = await getUserStatus(client, payload.email);

  if (user_status === 'VERIFIED') {
    throw new CustomError("user is already verified.", { statusCode: 400 });
  }

  if (user_status === 'UNVERIFIED') {
    await confirmUserSignUp(payload);
    await changeStatusOfUserVerified(client, payload.email);

    return {
      message: 'User verified successfully',
      status_code: 200,
      response: {},
    };
  }

  throw new CustomError("Invalid status", { statusCode: 400 });
}

async function confirmUserSignUp(payload) {
  try {
    const input = {
      ClientId: CLIENT_ID,
      Username: payload.email,
      ConfirmationCode: payload.otp,
    };

    const command = new ConfirmSignUpCommand(input);
    await cognitoClient.send(command);

  } catch (err) {
    console.error("Error occurred in confirmUserSignUp:", err);

    let message = "Unknown error during confirmation";
    if (err.__type === "CodeMismatchException") {
      message = "CodeMismatchException";
    } else if (err.__type === "ExpiredCodeException") {
      message = "ExpiredCodeException";
    } else if (err.__type === "TooManyFailedAttemptsException") {
      message = "TooManyFailedAttemptsException";
    } else if (err.__type === "TooManyRequestsException") {
      message = "TooManyRequestsException";
    }

    throw new CustomError(message, {
      name: "confirmUserSignUp",
      statusCode: 400,
    });
  }
}

async function changeStatusOfUserVerified(client, email) {
  try {
    const query = composeUpdateUserEmailVerifiedQuery(email);
    const result = await client.query(query);

    console.log("Update result:", result);

    if (!result.rows || result.rows.length === 0) {
      throw new CustomError('Invalid email or update failed', { statusCode: 400 });
    }

    return result.rows[0].status;

  } catch (error) {
    throw new CustomError(error.message, {
      statusCode: 400,
    });
  }
}

async function getUserStatus(client, email) {
  const query = `SELECT u.status
                FROM ${SCHEMA}.${USERS_TABLE_NAME}  u
                JOIN ${SCHEMA}.${USER_CONTACTS_TABLE_NAME}   uc ON u.id = uc.user_id  AND u.tenant_id = uc.tenant_id
                WHERE uc.email = $1`;
  const values = [email];

  try {
    const result = await client.query(query, values);

    console.log("Clinic status check result:", result);

    if (!result.rows || result.rows.length === 0) {
      throw new CustomError("Invalid Email or OTP", { statusCode: 404 });
    }

    return result.rows[0].status;

  } catch (error) {
    console.error("Error while fetching user status:", error);
    throw new CustomError(error.message, { statusCode: 500 });
  }
}

function composeUpdateUserEmailVerifiedQuery(email) {
  const updatedAt = new Date().toISOString();

  return {
    text: `UPDATE ${SCHEMA}.${USERS_TABLE_NAME} u
          SET status = $1,
              updated_at = $2
          FROM ${SCHEMA}.${USER_CONTACTS_TABLE_NAME} c
          WHERE u.id = c.user_id
            AND c.email = $3
          RETURNING u.status;`,
    values: ['VERIFIED', updatedAt, email],
  };
}
