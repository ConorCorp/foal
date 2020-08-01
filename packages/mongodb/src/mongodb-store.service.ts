import { Config, Session, SessionOptions, SessionState, SessionStore } from '@foal/core';
import { MongoClient } from 'mongodb';

export interface DatabaseSession {
  _id: string;
  userId?: string;
  content: { [key: string]: any };
  flash: { [key: string]: any };
  createdAt: number;
  updatedAt: number;
}

/**
 * MongoDB store.
 *
 * @export
 * @class MongoDBStore
 * @extends {SessionStore}
 */
export class MongoDBStore extends SessionStore {

  private mongoDBClient: any;
  private collection: any;

  async boot() {
    const mongoDBURI = Config.getOrThrow(
      'mongodb.uri',
      'string',
      'You must provide the URI of your database when using MongoDBStore.'
    );
    this.mongoDBClient = await MongoClient.connect(mongoDBURI, { useNewUrlParser: true, useUnifiedTopology: true });
    this.collection = this.mongoDBClient.db().collection('sessions');
  }

  async createAndSaveSession(content: object, options: SessionOptions = {}): Promise<Session> {
    const sessionID = await this.generateSessionID();
    await this.applySessionOptions(content, options);

    const date = Date.now();
    await this.collection.insertOne({
      _id: sessionID,
      content,
      createdAt: date,
      flash: {},
      updatedAt: date,
      userId: options.userId,
    });

    return new Session(this, {
      content,
      createdAt: date,
      // TODO: test this line.
      flash: {},
      id: sessionID,
      updatedAt: date,
      userId: options.userId ?? null,
    });
  }

  async update(state: SessionState): Promise<void> {
    await this.collection.updateOne(
      {
        _id: state.id
      },
      {
        $set: {
          content: state.content,
          flash: state.flash,
          updatedAt: state.updatedAt,
        }
      }
    );
  }

  async destroy(sessionID: string): Promise<void> {
    await this.collection.deleteOne({ _id: sessionID });
  }

  async read(sessionID: string): Promise<SessionState | undefined> {
    const timeouts = SessionStore.getExpirationTimeouts();

    const sessions = await this.collection.find({ _id: sessionID }).toArray();
    if (sessions.length === 0) {
      return undefined;
    }
    const databaseSession: DatabaseSession = sessions[0];

    if (Date.now() - databaseSession.updatedAt > timeouts.inactivity * 1000) {
      await this.destroy(sessionID);
      return undefined;
    }

    if (Date.now() - databaseSession.createdAt > timeouts.absolute * 1000) {
      await this.destroy(sessionID);
      return undefined;
    }

    return {
      content: databaseSession.content,
      createdAt: databaseSession.createdAt,
      flash: databaseSession.flash,
      id: databaseSession._id,
      updatedAt: databaseSession.updatedAt,
      userId: databaseSession.userId,
    };
  }

  async clear(): Promise<void> {
    await this.collection.deleteMany({});
  }

  async cleanUpExpiredSessions(): Promise<void> {
    const expiredTimeouts = SessionStore.getExpirationTimeouts();
    await this.collection.deleteMany({
      $or: [
        { createdAt: { $lt: Date.now() - expiredTimeouts.absolute * 1000 } },
        { updatedAt: { $lt: Date.now() - expiredTimeouts.inactivity * 1000 } }
      ]
    });
  }

  /**
   * This method should only be used to close the MongoDB connection.
   *
   * @returns {*} The MongoDB connection.
   * @memberof MongoDBStore
   */
  getMongoDBInstance(): any {
    return this.mongoDBClient;
  }

}
