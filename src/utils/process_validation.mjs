import jsonschema from "jsonschema";
import CustomError from "./CustomError.mjs";
let validate = jsonschema.Validator;
let schemaValidate = new validate();


export function payload_validations(schema, payload) {

  console.info("PROCESS SCHEMA ::", schema)
  console.info("PROCESS PAYLOAD ::", payload)

  try {
    schemaValidate.validate(payload, schema, { throwError: true });
  } catch (error) {
    let error_format = getErrorMessage(error);
    throw new CustomError(error_format.message, {
      name: "process_validation",
      errorCode: error_format.errorCode,
      priority: "LOW"
    });
  }

  return true;
}

function getErrorMessage(error) {
  const ERROR_MESSAGE = {
    required: " is required field.",
    pattern: " is not valid.",
    enum: " values are not valid.",
  };

  // Safe access to error.path[0]
  let param_name = (Array.isArray(error.path) && error.path.length > 0) 
    ? error.path[0] 
    : error.argument || "parameter";

  let message = error.schema?.errorMsg
    ? error.schema.errorMsg[error.name]
    : param_name + " " + error.message;

  let errorCode = getErrorCode(error);

  if (!message && error.name in ERROR_MESSAGE) {
    message = param_name + ERROR_MESSAGE[error.name];
  }

  return {
    errorCode: errorCode,
    message: message,
  };
}


function getErrorCode(error) {
  let error_code = 1000;
  try {
    error_code = error.schema["errorCode"][error.name];
  } catch (err) {
    if (err instanceof TypeError) {
      error_code =
        error?.schema?.properties?.[error.argument]?.errorCode?.[error.name];
    }
  }
  return error_code ? error_code : 2000;
}