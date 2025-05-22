export default class CustomError extends Error {  
  constructor(message, options = {}) {
      super(message);
      this.name = options.name ?? this.constructor.name;
      this.statusCode = options.statusCode ?? 400;
  }
}