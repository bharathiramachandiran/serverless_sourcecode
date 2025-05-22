import pg from "pg";
const { Pool } = pg;
import { getSecret } from "./commonUtils.mjs";
import CustomError from './CustomError.mjs';
const DATABASE_SECRET_ID = process.env.DATABASE_SECRET_ID;

/**
 * Represents a connection pool to a database.
 *
 * This class provides a singleton instance of a connection pool, ensuring that only one pool is created.
 * It also provides methods to close the connection pool and retrieve its current status.
 */
export default class DatabaseConnectionPool {
  static instance;

  /**
   * Creates a new instance of the DatabaseConnectionPool class.
   *
   * If an instance already exists, it returns the existing instance.
   * Otherwise, it sets the instance property to the current instance.
   *
   * @return {DatabaseConnectionPool} The instance of the DatabaseConnectionPool class.
   */
  constructor() {
    if (DatabaseConnectionPool.instance) {
      console.log("Reusing existing connection pool...");
      return DatabaseConnectionPool.instance;
    }
    DatabaseConnectionPool.instance = this;
  }

  /**
   * Ensures a database connection pool is established.
   *
   * If the pool does not exist, it creates a new connection pool using the provided database credentials.
   * It also sets up an event listener to close the connection pool when the process exits.
   *
   * @return {void}
   */
  async ensurePool() {
    if (this.pool) return;
    try {
      const dbCredentials = JSON.parse(await getSecret(DATABASE_SECRET_ID));
      console.log("Creating a new connection pool...");
      this.pool = new Pool({
        user: dbCredentials.username,
        host: dbCredentials.host,
        database: dbCredentials.database,
        password: dbCredentials.password,
        port: dbCredentials.port,
        ssl: { rejectUnauthorized: false },
        max: 5, // max number of clients in the pool
        application_name: "blueshirt_backend_service",
        connectionTimeoutMillis: 5000, // max 5 seconds to wait connection to be established
        idleTimeoutMillis: 3000,  // max 3 seconds to keep a client ideally connected
      });

      // when process exits, close db connection pool
      process.on("SIGTERM", async () => {
        console.info("[runtime] SIGTERM received");

        console.info("[runtime] closing user connection pool");
        await this.close();

        console.info("[runtime] exiting");
        process.exit(0);
      });

    } catch (err) {
      console.log("error on ensurePool : ", err);
      throw new CustomError("error occurred unable to create connection pool.",  {
          name: "ensurePool",
          statusCode: 500,
      });
    }
  }

  /**
   * Executes a database query using the provided SQL text and values.
   *
   * @param {Object} queryOptions - Options for the query.
   * @param {string} queryOptions.text - The SQL text of the query.
   * @param {Array} queryOptions.values - The values to be used in the query.
   * @return {Promise<Object>} The result of the query.
   */
  async query({ text, values }) {
    try {
      await this.ensurePool();
      console.log("Query Execution :: ", text);
      if (values) console.log("Query Values :: ", values);
      const result = await this.pool.query(text, values);
      this.getCurrentPoolStatus();
      return result;
    } catch (error) {
      console.error("Query error:", error);
      throw error;
    }
  }

  /**
   * Executes a database transaction using the provided callback function.
   *
   * The transaction is started by connecting to the database pool and executing a "BEGIN" query.
   * The callback function is then executed with the client object as an argument.
   * If the callback function completes successfully, the transaction is committed by executing a "COMMIT" query.
   * If an error occurs during the callback function, the transaction is rolled back by executing a "ROLLBACK" query.
   *
   * @param {function} callback - the function to execute within the transaction
   * @return {any} the result of the callback function
   */
  async transaction(callback, args={}) {
    await this.ensurePool();
    const client = await this.pool.connect();
    try {
      console.log("BEGIN :: Transaction started");
      await client.query("BEGIN");
      const result = await callback(client, args);
      console.log("COMMIT :: Transaction success");
      await client.query("COMMIT");
      return result;
    } catch (error) {
      console.error("ROLLBACK :: Transaction error :: ", error);
      await client.query("ROLLBACK");
      throw error;
    } finally {
      console.log("END :: Transaction ended, client released");
      client.release();
      this.getCurrentPoolStatus();
    }
  }

  /**
   * Asynchronously gets a client for a custom transaction and begins the transaction.
   *
   * @return {Promise<object>} A Promise that resolves with the client object for the transaction.
   */
  async getTransactionClient() {
    await this.ensurePool();
    const client = await this.pool.connect();
    console.log("BEGIN :: Custom Client Transaction Created");
    await client.query("BEGIN");
    this.getCurrentPoolStatus();
    return client;
  }

  /**
   * Ends a custom client transaction.
   *
   * Commits or rolls back the transaction based on the provided flag.
   * Releases the client and updates the current pool status.
   *
   * @param {object} client - The client object associated with the transaction.
   * @param {boolean} [shouldCommit=true] - Flag to commit or rollback the transaction.
   * @return {Promise<void>} Resolves when the transaction is ended.
   */
  async endTransaction(client, shouldCommit = true) {
    try {
      if (shouldCommit) {
        console.log("COMMIT :: Custom Client Transaction success");
        await client.query("COMMIT");
      } else {
        console.log("ROLLBACK :: Custom Client Transaction");
        await client.query("ROLLBACK");
      }
    } catch (error) {
      console.error("Transaction end error:", error);
      throw error;
    } finally {
      console.log("END :: Transaction ended, client released");
      client.release();
      this.getCurrentPoolStatus();
    }
  }

  /**
   * Closes the connection pool if it exists.
   *
   * @return {Promise<void>} A Promise that resolves when the connection pool is closed.
   */
  async close() {
    if (!this.pool) {
      console.log("No connection pool to close");
      return;
    }
    this.getCurrentPoolStatus();
    console.log("Closing connection pool...");
    await this.pool.end();
  }

  /**
   * Retrieves and logs the current status of the connection pool.
   *
   * @return {void} No return value, logs the pool status to the console.
   */
  getCurrentPoolStatus() {
    console.log("Connection Pool Status :: ", {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    });
  }
}
