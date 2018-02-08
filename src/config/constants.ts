export namespace Constants {
    export const POSTGRES_DB_CONFIG = {
        // tslint:disable-next-line:max-line-length
        connectionString: 'postgres://mzjseajwunmjbi:2add0b650f12012c219677ce95c13b36379f3d0df8f9f569cd15ba5623423f50@ec2-54-83-204-230.compute-1.amazonaws.com:5432/dei96aqio25l8r',
        ssl: true,
    };
    export const API_END_POINTS = {
        GET_PROJECT_AND_TASK_DETAILS: 'https://ap5.salesforce.com/services/apexrest/ProductSerivce',
        UPDATE_PROJECT_OR_TASK_DETAILS: 'https://ap5.salesforce.com/services/data/v40.0/sobjects/ProjectTaskService__e',
    };
    export const RESPONSE_STATUS = {
        SUCCESS: 'SUCCESS',
        ERROR: 'ERROR',
    };
    export const MESSAGES = {
        SAVED: 'Data saved successfully',
        UPDATED: 'Data updated successfully',
        SOMETHING_WENT_WRONG: 'something went wrong',
        INVALID_SESSION_ID: 'Invalid session id',
    };
    export const SALESFORCE_PLATFORM_EVENTS_CONFIG = {
        URL: 'https://c.ap5.visual.force.com/cometd/40.0/',
        EVENT: '/event/ProjectTaskService__e',
        OAUTH: {
            url: 'https://ap5.salesforce.com/services/oauth2/token',
            grant_type: "refresh_token",
            client_id: "3MVG9d8..z.hDcPJvS1kmRShyWMlrH2GkDXefwC.1dAylEi0bWd3yh6Q7xOlp3_9Ex9XAj_MJBiHPbtQ7YwKu",
            client_secret: "6637042274278747657",
            refresh_token: "5Aep8613hy0tHCYdhwfV72zcrObyt1SiQpoPS6OQCtnA8L_SxwRXduNgskPEK52EGDD_8E9U39ytarA0HsyyWwv",
        },
    };
}
