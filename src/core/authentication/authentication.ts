import { AuthDataModel } from './auth.datamodel';
import { IHasToken, IOAuthToken } from './oauth-model';
import * as express from 'express';
import * as rp from 'request-promise';
import * as request from 'request';
import { Constants } from '../../config/constants';

/**
 *  This middleware class for authorization of request
 */
export class Authentication {
    private authDataModel: AuthDataModel;
    constructor() {
        this.authDataModel = new AuthDataModel();
    }

    public ensureAuthorized(req: express.Request, res: express.Response, next: express.NextFunction): void {
        next();
    }
    /**
     * Gets a valid access token for the org
     * @param vanityKey vanity key for the org.
     */
    public async getAccessToken(vanityKey: any): Promise<IOAuthToken> {
        return await this.authDataModel.getAccessToken(vanityKey);
    }
    public authenticateAndRun(orgConfig: IHasToken, callback: (error: any, token?: IOAuthToken) => void): void {
        try {
            if (orgConfig && orgConfig.refresh_token) {
                this.authDataModel.getAccessTokenByRefreshToken(orgConfig.refresh_token).then((token) => {
                    if (token) {
                        if (callback) {
                            callback(null, token);
                        }
                        return token;
                    }
                })
            }
        } catch (err) {
            if (callback) {
                callback(err, undefined);
            }
        }
    }
    public async authenticateAndRunAsync(orgConfig: IHasToken, callback: (error: any, token?: IOAuthToken) => void): Promise<IOAuthToken | undefined> {
        try {
            if (orgConfig && orgConfig.refresh_token) {
                const token = await this.authDataModel.getAccessTokenByRefreshToken(orgConfig.refresh_token);
                if (token) {
                    if (callback) {
                        callback(null, token);
                    }
                    return token;
                }
            }
        } catch (err) {
            if (callback) {
                callback(err, undefined);
            }
        }
    }
}
