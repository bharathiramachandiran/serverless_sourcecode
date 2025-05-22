import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { generate_out_put_response } from "../utils/commonUtils.mjs";
import CustomError from "../utils/CustomError.mjs";

const CLIENT_ID = process.env.CLIENT_ID;
const REGION = process.env.REGION;
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function resendSignupOtp(email) {
  if (!email) {
    throw new CustomError("Email is required", { statusCode: 400 });
  }

  try {
    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    await cognitoClient.send(command);

  } catch (err) {
    console.error("Error in resendSignupOtp:", err);

    let message = "Unknown error during resend OTP";

    if (err.name === "UserNotFoundException") {
      message = "User not found";
    } else if (err.name === "InvalidParameterException") {
      message = "User already verified";
    } else if (err.name === "TooManyRequestsException") {
      message = "Too many requests. Please try again later.";
    } else if (err.name === "LimitExceededException") {
    message = "Too many attempts. Please wait a moment before trying again.";
    }

    throw new CustomError(message, {
      name: "resendSignupOtp",
      statusCode: err.statusCode || 400,
    });
  }
}

export const handler = async (event) => {
  let response = {};
  let message = "Failed to resend signup OTP";
  let status_code = 400;

  try {
    const payload = JSON.parse(event.body || "{}");

    if (!payload.email) {
      throw new CustomError("Email is required", { statusCode: 400 });
    }

    await resendSignupOtp(payload.email);

    message = "Signup confirmation code resent successfully";
    status_code = 200;
    response = {};

  } catch (err) {
    console.error("Signup Resend OTP Error:", err);

    message = err.message;
    status_code = err.statusCode || 500;
    response = err
    if (err instanceof CustomError) {
      status_code = err.statusCode;
      message = err.message;
      response = err
    }
  }
  finally{
  return generate_out_put_response(response, message, status_code);
  }
};
