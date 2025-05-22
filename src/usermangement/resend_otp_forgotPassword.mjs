import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generate_out_put_response } from "../utils/commonUtils.mjs";
import CustomError from "../utils/CustomError.mjs";

const CLIENT_ID = process.env.CLIENT_ID;
const REGION = process.env.REGION;

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function sendForgotPasswordCode(email) {
   try {
    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    await cognitoClient.send(command);

  } catch (err) {
    console.error("Error in sendForgotPasswordCode:", err);

    let message = "Unknown error during forgot password";

    if (err.name === "UserNotFoundException") {
      message = "User not found";
    } else if (err.name === "InvalidParameterException") {
      message = "Invalid parameters provided";
    } else if (err.name === "TooManyRequestsException") {
      message = "Too many requests. Please try again later.";
    } else if (err.name === "LimitExceededException") {
      message = "Attempt limit exceeded. Please try again later.";
    }

    throw new CustomError(message, {
      name: "sendForgotPasswordCode",
      statusCode: err.$metadata?.httpStatusCode || 400,
    });
  }
}


export const handler = async (event) => {
  let response = {};
  let message = "Failed to send forgot password code";
  let status_code = 400;

  try {
    const payload = JSON.parse(event.body || "{}");

    if (!payload.email) {
      throw new CustomError("Email is required", { statusCode: 400 });
    }

    await sendForgotPasswordCode(payload.email);

    message = "Password reset code sent successfully";
    status_code = 200;
    response = {};

  } catch (err) {
    console.error("Forgot Password Error:", err);

    message = err.message;
    status_code = err.statusCode || 500;
    response = err
    if (err instanceof CustomError) {
      status_code = err.statusCode;
      message = err.message;
      response = err
  }
}
finally {
  return generate_out_put_response(response, message, status_code);
}
};
