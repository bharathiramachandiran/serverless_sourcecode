def hello(event, context):
    return {
        "statusCode": 200,
        "body": "Hello from Serverless!"
    }

def world(event, context):
    return {
        "statusCode": 200,
        "body": "Hello World from Serverless!"
    }

# test
