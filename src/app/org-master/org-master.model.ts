import { Client } from 'pg';
import { Constants } from '../../config/constants';
import { error } from 'util';
import { IOrgMaster } from '../../core/models/org-master';
import { utils } from '../../utils/utils';
import { AppError, OrgError } from '../../utils/errors';

/**
 * @description Handles all database functions for OrgMaster table
 */
export class OrgMasterModel {

    constructor() {

    }
    /**
     * @description Gets the details of all the registered orgs.
     * @param callback callback function
     */
    public getAllOrgDetails(callback: (error: Error, results: IOrgMaster[]) => void) {
        const pgClient = new Client(Constants.POSTGRES_DB_CONFIG);
        pgClient.connect();
        // const queryString = 'SELECT DISTINCT ON (user_id) * FROM ORG_MASTER';
        const queryString = 'SELECT DISTINCT ON (org_id) * FROM ORG_MASTER';
        const orgConfigMap = new Map<string, any>();

        pgClient.query(queryString, (error1, results) => {
            pgClient.end();
            callback(error1, results.rows);
        });
    }
    public async getOrgConfigByVanityId(vanityId: string, callback?: (error?: Error, config?: IOrgMaster) => void): Promise<IOrgMaster> {
        const pgClient = new Client(Constants.POSTGRES_DB_CONFIG);
        pgClient.connect();
        const queryString = "SELECT * FROM ORG_MASTER WHERE $1 like vanity_id || '%'";
        const orgConfigMap = new Map<string, any>();
        try {
            const results = await pgClient.query(queryString, [vanityId]);
            pgClient.end();
            // console.log(results.rows[0]);
            if (results && results.rows.length > 0) {
                if (callback) {
                    callback(undefined, results.rows[0]);
                }
                return results.rows[0];
            } else {
                if (callback) {
                    callback(new OrgError('no data for the given vanity id'), undefined);
                }
                throw new OrgError('no data for the given vanity id');
            }

        } catch (error) {
            if (callback) {
                callback(error, undefined);
            }
            throw error;
        }

    }
    public getOrgConfigByOrgId(orgId: string, callback: (error: Error, config?: IOrgMaster) => void) {
        const encryptedOrgId = utils.encryptCipher(orgId, Constants.ENCRYPTION.ORG_ID_ENCRYPTION_KEY);
        const pgClient = new Client(Constants.POSTGRES_DB_CONFIG);
        pgClient.connect();
        const queryString = "SELECT * FROM ORG_MASTER WHERE $1 like ORG_ID || '%'";
        pgClient.query(queryString, [encryptedOrgId], (error1, results) => {
            pgClient.end();
            // console.log(results.rows[0]);
            if (!error1 && results && results.rows.length > 0) {
                callback(error1, results.rows[0]);
            } else {
                callback(error1, undefined);
            }
        });
    }
    public async getOrgConfigByOrgIdAsync(orgId: string): Promise<IOrgMaster> {
        const encryptedOrgId = utils.encryptCipher(orgId, Constants.ENCRYPTION.ORG_ID_ENCRYPTION_KEY);
        const pgClient = new Client(Constants.POSTGRES_DB_CONFIG);
        pgClient.connect();
        const queryString = "SELECT * FROM ORG_MASTER WHERE $1 like ORG_ID || '%'";
        const result = await pgClient.query(queryString, [encryptedOrgId]);
        if (result && result.rows.length > 0) {
            return result.rows[0];
        } else {
            throw { code: 0, message: "Org not registered" };
        }
    }
    public async updateAccessToken(orgId: number | string, accessToken: string): Promise<boolean> {
        const encryptedOrgId = utils.encryptCipher(orgId, Constants.ENCRYPTION.ORG_ID_ENCRYPTION_KEY);

        const pgClient = new Client(Constants.POSTGRES_DB_CONFIG);
        pgClient.connect();
        const queryString = "UPDATE org_master SET access_token = $1 WHERE $2 LIKE org_id || '%'";
        const orgConfigMap = new Map<string, any>();
        const result = await pgClient.query(queryString, [accessToken, encryptedOrgId]);
        if (result && result.rowCount > 0) {
            return result.rowCount > 0;
        } else {
            throw new AppError("No record found");
        }
    }
}
