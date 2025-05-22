import CustomError from "../utils/CustomError.mjs";
import { generate_out_put_response } from "../utils/commonUtils.mjs";
import { payload_validations } from "../utils/process_validation.mjs";
import { FORGET_PASSWORD_REQUEST } from "./schema_config.mjs"
import{  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import DatabaseConnectionPool from "../utils/ConnectionPool.mjs";
 
const dbPool = new DatabaseConnectionPool();

const CLIENT_ID = process.env.CLIENT_ID
const USER_POOL_ID = process.env.USER_POOL_ID
const SCHEMA = process.env.SCHEMA_NAME
const USER_CONTACTS_TABLE_NAME = process.env.USER_CONTACTS_TABLE_NAME
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const CLINIC_TABLE_NAME = process.env.CLINIC_TABLE_NAME
const REGION = process.env.AWS_REGION;
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
 
export const handler = async (event) => {
 
  let resp = {};
  let message = "error occurred, forget password request failed";
  let status_code = 400;
 
  try {
 
    let payload = JSON.parse(event.body || "{}");
    let path = event.path.replace(/^\/test/, '');
    payload.path = path
    console.log("Path", path);
 
    if (Object.keys(payload).length === 0) {
      throw new CustomError("Bad Request: No payload",{status_code: 400});
    }
 
    const result = await dbPool.transaction(handleForgotPassword, payload);
    resp = result.response;
    message = result.message;
    status_code = result.statusCode;
    console.log("result of transaction: ", result);
   
  } catch (err) {
    console.log("error occured in forget password ", err);
    message = err.message;
    status_code = 500;
    if(err instanceof CustomError) {
      status_code = err.statusCode;
      resp = err;
    }
  } finally {
    return generate_out_put_response(resp, message, status_code);
  }
};
 
async function handleForgotPassword(client, payload) {

  let message;
  let status_code;
  let response = {};

  if (payload.path === "/user/forgot-password") {
    payload_validations(FORGET_PASSWORD_REQUEST, payload);
    await isValidUserToResetPassword(client, payload.email);

    let user_status = await getUserStatus(payload.email);
    if (user_status === "UNCONFIRMED") {
      throw new CustomError("UNCONFIRMED user, cannot perform forget password.", {});
    }

    await sendForgetPasswordVerificationCode(payload.email);
    message = "Verification code sent successfully.";
    status_code = 201;
    response = { email: payload.email };
  }

  else if (payload.path === "/user/forgot-password/confirm") {
    payload_validations(FORGET_PASSWORD_REQUEST, payload);
    await isValidUserToResetPassword(client, payload.email);
    console.log("Success fullly executed");
    let user_status = await getUserStatus(payload.email);
    if (user_status === "UNCONFIRMED") {
      throw new CustomError("UNCONFIRMED user, cannot perform forget password confirm.", {});
    }

    await confirmNewPassword(payload);
    message = "Password changed successfully.";
    status_code = 201;
    response = { email: payload.email };
  }
  
  else {
    throw new CustomError("Invalid path: " + payload.path);
  }

  return {
    response,
    message,
    statusCode: status_code,
  };
}

 
async function sendForgetPasswordVerificationCode(email) {
  try {
    const input = {
      ClientId: CLIENT_ID,
      Username: email,
    };
    const command = new ForgotPasswordCommand(input);
    const response = await cognitoClient.send(command);
    console.log(response);

  } catch (err) {
    console.error("Error occurred while sending forgot password OTP:", err);

    let status_code = 500;
    let message = err.message || "An unknown error occurred.";

    if (err.name === "UserNotFoundException" || message.includes("Username/client id combination not found")) {
      message = "User not found. Please check the email address.";
      status_code = 404;
    } else if (err.name === "CodeDeliveryFailureException") {
      message = "Failed to send confirmation code. Please try again later.";
      status_code = 400;
    } else if (err.name === "TooManyRequestsException") {
      message = "Too many attempts. Please wait before trying again.";
      status_code = 429;
    }
    throw new CustomError(message, {
      name: "sendVerificationCode",
      statusCode: status_code
    });
  }
}

 
async function confirmNewPassword(payload) {
  try {
    const input = {
      ClientId: CLIENT_ID,
      Username: payload.email,
      ConfirmationCode: payload.code,
      Password: payload.password,
    };
    const command = new ConfirmForgotPasswordCommand(input);
    const new_password_response = await cognitoClient.send(command);
    console.log(new_password_response);
  } catch (err) {
    console.log("Error occurred in verify code:", err);
    let message = err.message;
    let status_code = 500;
 
    switch (err.__type) {
      case "UserNotFoundException":
        message = "The email address you entered is incorrect or does not exist.";
        status_code = 400;
        break;
 
      case "UserNotConfirmedException":
        message = "This user account has not been confirmed. Please verify your email first.";
        status_code = 400;
        break;
 
      case "CodeMismatchException":
        message = "The verification code you entered is incorrect";
        status_code = 400;
        break;
 
      case "ExpiredCodeException":
        message = "Your verification code has expired. Please request a new one.";
        status_code = 400;
        break;
 
      case "TooManyFailedAttemptsException":
        message = "Too many incorrect attempts. Please try again later.";
        status_code = 400;
        break;
    }
 
    throw new CustomError(message, { 
      name: "verify_code", 
      statusCode: status_code 
    });
  }
}
 
function composeGetUserDetails(email) {
  return {
      text: `SELECT *
            FROM ${SCHEMA}.${USERS_TABLE_NAME}  u
            JOIN ${SCHEMA}.${USER_CONTACTS_TABLE_NAME}  uc ON u.id = uc.user_id  AND u.tenant_id = uc.tenant_id
            WHERE uc.email = $1`,
      values: [email]
  };
}
 
async function isValidUserToResetPassword(client, email) {
  try {
    let user_details_query = composeGetUserDetails(email);
    const res = await client.query(user_details_query);
    if(res.rowCount === 0){
      throw new CustomError("email address does not exists.", {status_code: 400});
    }
    return true;
  }
  catch (err) {
    console.log("error occurred in isValidUserToResetPassword ", err);
    let message = "error occurred in isValidUserToResetPassword, " + err.message;
    let status_code = 500;
    if(err instanceof CustomError) {
      console.log(err.status_code);
      message = err.message;
      status_code = err.statusCode;
    }
    throw new CustomError(message, { name: "isValidUserToResetPassword", statusCode: status_code });
  }
}

 async function getUserStatus(user_name){
  try {
      const input = { 
        UserPoolId: USER_POOL_ID, 
        Username: user_name, 
      };
      const command = new AdminGetUserCommand(input);
      const response = await cognitoClient.send(command);
      console.log(response);
      return response.UserStatus;
    } 
  catch (err) {
    console.log("error occurred in checkStatusOfUser ", err);
    let message = "error occurred in checkStatusOfUser, " + err.message;
    let status_code = 500;
    if(err.__type === 'UserNotFoundException') {
      message = "invalid email or mobile number.";
      status_code = 400;
    }
    throw new CustomError(message, {
      name: "getUserStatus", 
      status_code: err.status_code
    });  
  }    
}