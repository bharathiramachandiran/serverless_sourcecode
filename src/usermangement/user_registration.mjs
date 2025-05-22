import { CognitoIdentityProviderClient, SignUpCommand, AdminDeleteUserCommand, AdminGetUserCommand, ResendConfirmationCodeCommand } from '@aws-sdk/client-cognito-identity-provider';
import DatabaseConnectionPool from '../utils/ConnectionPool.mjs'
import { v4 as uuidv4 } from 'uuid';
import CustomError from '../utils/CustomError.mjs';
import { generate_out_put_response } from '../utils/commonUtils.mjs';
import { payload_validations } from '../utils/process_validation.mjs';
import { USER_REGISTRATION } from './schema_config.mjs';
 
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const dbPool = new DatabaseConnectionPool();

const CLIENT_ID = process.env.CLIENT_ID
const USER_POOL_ID = process.env.USER_POOL_ID
const SCHEMA = process.env.SCHEMA_NAME
const USER_DETAILS_TABLE_NAME = process.env.USER_DETAILS_TABLE_NAME
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const TENANTS_TABLE_NAME = process.env.TENANTS_TABLE_NAME
const USER_CONTACTS_TABLE_NAME = process.env.USER_CONTACTS_TABLE_NAME
 
export const handler = async (event) => {
  let response = {};
  let message = 'Error occurred, unable to register the user';
  let status_code = 400;
 
  try {
    const payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    console.log('Received payload:', payload);
 
    const user_id = uuidv4();
    const tenant_id = uuidv4();
    const role = 'Admin'
    payload.user_id = user_id
    payload.tenant_id = tenant_id
    payload.role = role

    if (Object.keys(payload).length === 0) {
      throw new CustomError("Bad Request: No payload", {
        name: "BadRequestException",
        statusCode: 400
      });
    }
     
    payload_validations(USER_REGISTRATION, payload)
    const result = await dbPool.transaction(handleCreateUser, payload);
    response = result.response;
    message = result.message;
    status_code = result.status_code;
 
  } catch (err) {
    if (err instanceof CustomError) {
      console.error('CustomErrorHandler ', err);
      status_code = err.status_ode || 400;
      message = err.message;
      response = err;  
    } else {
      console.error('Unhandled Error', err);
      status_code = 500;
      message = err.message || message;
      response = err;
    }
  } finally {
    return generate_out_put_response(response, message, status_code);
  }
};


const handleCreateUser = async (client, payload) => {
  let message = 'User already exists ';
  let status_code = 400;
  let type 
  let errorName 
  
  try {
    const userStatus = await checkCognitoUserStatus(payload.email);

    if (userStatus === "NOT_FOUND") {
      const register_result = await createCognitoUser(payload);
      payload.auth_id = register_result.UserSub;
      message = 'User registered successfully';
      status_code = 200;
    } 
    else if (userStatus === "UNCONFIRMED") {
      await resendVerificationCode(payload.email);
      message = 'User exists but is not verified. Verification code has been resent';
      status_code = 200;
      type = 'signup'
    }

    await insertUser(client, payload);

    return {
      message: message,
      status_code: status_code,
      response: { user_id: payload.user_id, type: type }
    };
  } catch (err) {
    console.error('[User Registration Failed at Cognito or DB insert:', err);

    if (payload.auth_id) {
      await deleteCognitoUser(payload.email);
    }
    message = err.message || 'An error occurred during user registration';
    status_code = err.status_code || 500;
    errorName = err.name || 'HandleCreateUserError';

    if (err instanceof CustomError) {
      message = err.message;
      status_code = err.status_code;
      errorName = err.name;
    }
    throw new CustomError(message, {
      name: errorName,
      status_code: status_code,
    });
  }
};


async function checkCognitoUserStatus(email) {
  let message 
  let status_code = 400;
  try {
    const input = { 
      UserPoolId: USER_POOL_ID, 
      Username: email
    };
    const command = new AdminGetUserCommand(input);
    const response = await cognitoClient.send(command);
    console.log("User status checked:", response.UserStatus);
    return response.UserStatus;
  } 
  catch (err) {
    console.log("Error checking user status:", err);
    message = err.message
    status_code = err.status_code  || 500
    if (err.__type === 'UserNotFoundException') {
      message = "User not found";
      status_code = 400;
    }
    throw new CustomError(message, {
      name: "UserStatusCheckException",
      status_Code: 400
    });
  }
}

const createCognitoUser = async ({ tenant_id, user_id, role, email, password }) => {
  try {
    const command = new SignUpCommand({
      ClientId: process.env.CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:user_id', Value: user_id },
        { Name: 'custom:tenant_id', Value: tenant_id },
        { Name: 'custom:role', Value: JSON.stringify(role) },
      ],
    });

    const result = await cognitoClient.send(command);
    console.log('[Cognito] Signup successful. Auth ID:', result.UserSub);
    return result;
 
  } catch (err) {
    console.error("Error occurred during signup:", err);
 
    let message = "An error occurred during signup.";
    let status_code = 500;
    let errorType;
 
    if (err.__type === "InvalidPasswordException") {
      message = "The password does not meet Cognito's complexity requirements.";
      status_code = 400;
      errorType = "InvalidPasswordException";
    }
    else if (err.__type === "UsernameExistsException") {
      message = "An account already exists with this email address.";
      status_code = 400;
      errorType = "UsernameExistsException";
    }
    else if (err.__type === "InvalidParameterException") {
      message = "One or more signup parameters are invalid.";
      status_code = 400;
      errorType = "InvalidParameterException";
    }
    else if (err instanceof CustomError) {
      message = err.message;
      status_code = err.status_ode;
      errorType = err.name;
    }
    
    throw new CustomError(message, {
      name: errorType || "SignupException",
      status_code: status_code
    });
  }
};
 
const insertUser = async (client, payload) => {
    let message = "Failed to save user data";
    let status_code = 500;
  try {
    const result= await client.query(insertIntoTenantsQuery(payload));
    console.log(result);
    const result1= await client.query(insertIntoUsers(payload));
    console.log(result1)

    await client.query(insertIntoUserDetailsQuery(payload));
    await client.query(insertIntoUserContacts(payload));
  } catch (err) {
    console.error('[DB] Failed to insert user data:', err);
 
    if (err.message.includes("tenants")) {
      message = "Failed to insert tenants data";
    } else if (err.message.includes("users")) {
      message = "Failed to insert user";
    } else if (err.message.includes("user_details")) {
      message = "Failed to insert user details";
    } else if (err.message.includes("user_contacts")) {
      message = "Failed to insert user contacts";
    }
    throw new CustomError(message, {
      name: "InsertUserError",
      status_code: status_code,
    });
  }
};

async function resendVerificationCode(email) {
  try {
    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email
    });
    await cognitoClient.send(command);
    console.log("Verification code resent to:", email);
    return true;
  } catch (err) {
    console.error("Failed to resend verification code:", err);
    throw new CustomError("Failed to resend verification code", {
      name: "ResendConfirmationCodeError",
      status_code: 500
    });
  }
}

const deleteCognitoUser = async (email) => {
  const command = new AdminDeleteUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
  });
  await cognitoClient.send(command);
  console.log('[Cognito] Deleted user:', email);
};
 
 
function insertIntoTenantsQuery({ tenant_id}) {
  return {
    text: `INSERT INTO ${SCHEMA}.${TENANTS_TABLE_NAME}
          (id) VALUES ($1) RETURNING id; `,
    values: [tenant_id],
  };
}
 
function insertIntoUsers({ user_id, auth_id, tenant_id }) {
  return {
    text: `INSERT INTO ${SCHEMA}.${USERS_TABLE_NAME}  
          (id, auth_id, tenant_id, status)
          VALUES ($1, $2, $3, $4);`,
    values: [user_id, auth_id, tenant_id,'UNVERIFIED'],
  };
}

function insertIntoUserContacts({ user_id,tenant_id, email}) {
  return {
    text: `INSERT INTO ${SCHEMA}.${USER_CONTACTS_TABLE_NAME}  
          (user_id, tenant_id, email)
          VALUES ($1, $2, $3);`,
    values: [user_id, tenant_id, email],
  };
}
 
function insertIntoUserDetailsQuery({ user_id, tenant_id, role , first_name, last_name }) {
  return {
    text: `INSERT INTO ${SCHEMA}.${USER_DETAILS_TABLE_NAME}
          (user_id, tenant_id, role, first_name, last_name)
          VALUES ($1, $2, $3, $4, $5);`,
    values: [user_id, tenant_id, role, first_name, last_name],
  };
}

