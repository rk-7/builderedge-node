import * as express from "express";
import * as request from 'request';
import * as async from 'async';

import { ProjectModel, IProjectRequest, IProjectDetails, ITaskDetails } from './project.model';
import { formatProjectDetails, buildInsertStatements, formatSalesForceObject } from './project.helper';
import { Constants } from '../../config/constants';

export class ProjectController {
    private projectModel: ProjectModel;
    constructor() {
        this.projectModel = new ProjectModel();
    }

    create(req: express.Request, res: express.Response, next: express.NextFunction) {
        let reqParams: IProjectRequest;
        try {
            reqParams = {
                name: req.body.name,
                start_date: req.body.start_date,
                end_date: req.body.end_date,
                completion_per: req.body.completion_per,
                created_by: req.body.created_by,
                updated_by: req.body.created_by,
            };

            this.projectModel.create(reqParams, (error, results) => {
                if (!error) {
                    res.send({ status: Constants.RESPONSE_STATUS.SUCCESS, message: Constants.MESSAGES.SAVED, results: results });
                } else {
                    res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: error });
                }
            });
        } catch (e) {
            res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: Constants.MESSAGES.SOMETHING_WENT_WRONG });
        }
    }

    getalldetails(req: express.Request, res: express.Response, next: express.NextFunction) {
        let that = this;
        try {
            if (req.body.session_id) {
                // Get project details from salesforce api
                let requestHeader = {
                    headers: {
                        'Authorization' : 'Bearer ' + req.body.session_id,
                        'Content-Type': 'application/json'
                    }
                };
                request(Constants.API_END_POINTS.GET_PROJECT_AND_TASK_DETAILS, requestHeader, (error, response) => {
                    if (!error) {
                        if (response.statusCode === 401) {
                            res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: response.body[0].message })
                        } else {
                            if (response.body && response.body.length > 0) {
                                let projectArray: Array<IProjectDetails> = response.body;
                                if (typeof response.body === 'string') {
                                    projectArray = JSON.parse(response.body);
                                }
                                let projects = formatProjectDetails(projectArray);

                                that.syncSalesforceUserDetails.call(that, req.body.session_id, projects);
                                res.send({ status: Constants.RESPONSE_STATUS.SUCCESS, message: '', projects: projects });
                            }
                        }
                    } else {
                        res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: error })
                    }
                });
            } else {
                res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: Constants.MESSAGES.INVALID_SESSION_ID });
            }
        }
        catch (error) {
            console.log(error);
            res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: Constants.MESSAGES.SOMETHING_WENT_WRONG });
        }
    }

    updateProject(req: express.Request, res: express.Response, next: express.NextFunction) {
        this.updateProjectOrTask(req, res, true)
    }

    updateTask(req: express.Request, res: express.Response, next: express.NextFunction) {
        this.updateProjectOrTask(req, res, false)
    }

    updateProjectOrTask(req: express.Request, res: express.Response, isProjectRequest: boolean) {
        try {
            let sessionId = req.body.session_id;
            if (sessionId) {
                let that = this;
                let asyncTasks = [];
                let records = req.body.records;

                that.projectModel.updateProjectsOrTasks(records, isProjectRequest, (error, results) => {
                    console.log(error, results);
                    if (!error) {
                        res.send({ status: Constants.RESPONSE_STATUS.SUCCESS, message: Constants.MESSAGES.UPDATED });

                        // Update salesforce data
                        if (results && results.length > 0) {
                            that.preparedRequestAndUpdateSalesforceDB.call(that, sessionId, records, isProjectRequest);
                        }
                    } else {
                        res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: error });
                    }
                });
            } else {
                res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: Constants.MESSAGES.INVALID_SESSION_ID });
            }
        }
        catch (error) {
            res.send({ status: Constants.RESPONSE_STATUS.ERROR, message: Constants.MESSAGES.SOMETHING_WENT_WRONG });
        }
    }


    preparedRequestAndUpdateSalesforceDB(sessionId: string, results, isProjectRequest) {
        let data = { ProjectTasks: [], Projects: [] };
        if (isProjectRequest) {
            results.forEach((row) => {
                data.Projects.push(formatSalesForceObject(row))
            });
        } else {
            results.forEach((row) => {
                data.ProjectTasks.push(formatSalesForceObject(row))
            });
        }
        let requestData = {
            Data__c: JSON.stringify(data)
        };
        this.postRequestOnSalesforce(Constants.API_END_POINTS.UPDATE_PROJECT_OR_TASK_DETAILS, sessionId, requestData);
    }

    // Following function sent post request on salesforce endpoints
    postRequestOnSalesforce(url: string, sessionId: string, data, callback?: (error: Error, results: any) => void) {
        let requestObj = {
            url: url,
            headers: {
                'Authorization' : 'Bearer ' + sessionId,
                'Content-Type': 'application/json'
            },
            json: true,
            body: data
        };
        console.log('In postRequestOnSalesforce requestObj - ', requestObj);
        request.post(requestObj, (error, response) => {
            console.log('In postRequestOnSalesforce', error, response.body);
            if (callback) {
                callback(error, response);
            }
        });
    }

    // Following function  insert all project and tasks into postgres database and
    //  call salesforce endpoints to updates salesforce record external_id with postgres record id 
    syncSalesforceUserDetails(sessionId: string, salesforceResponseArray) {
        let that = this;
        try {
            let projectRecords = JSON.parse(JSON.stringify(salesforceResponseArray));

            // Filter newly added projects, those records which hasn't external_id
            projectRecords = projectRecords.filter((self) => {
                if (!self['external_id']) {
                    return true;
                }
            });

            if (projectRecords && projectRecords.length > 0) {
                let queryConfig = buildInsertStatements(projectRecords, ['_id', 'external_id'], true);
                // Insert Projects records
                that.projectModel.insertManyStatements(queryConfig, (error, projectResult) => {
                    if (!error) {
                        // console.log('In execMultipleStatment projectResult>>', projectResult);
                        let salesforceRequestObj = { ProjectTasks: [], Projects: [] };
                        let pksExternalPksMap = {}, taskRecords = [];

                        // Prepared  object to update postgres id into salesforce databse
                        projectResult.rows.forEach((row) => {
                            pksExternalPksMap[row.external_id] = row._id;
                            salesforceRequestObj.Projects.push({ Id: row.external_id, External_Id__c: row._id });
                        });

                        salesforceResponseArray.forEach(projectRecord => {
                            let projectId = pksExternalPksMap[projectRecord['id']] || projectRecord['external_id'];
                            if (projectRecord.series && projectRecord.series.length > 0 && projectId) {
                                projectRecord.series.forEach((taskRecord) => {
                                    taskRecord['project_ref_id'] = projectId;
                                    taskRecords.push(taskRecord);
                                });
                            }
                        });

                        if (taskRecords && taskRecords.length) {
                            let tasksQueryConfig = buildInsertStatements(taskRecords, ['_id', 'external_id'], false);
                            that.projectModel.insertManyStatements(tasksQueryConfig, (error, taskResult) => {
                                if (!error) {
                                    // console.log('In execMultipleStatment task taskResult>>', taskResult);

                                    // Prepared  object to update postgres id into salesforce databse
                                    taskResult.rows.forEach((row) => {
                                        salesforceRequestObj.ProjectTasks.push({ Id: row.external_id, External_Id__c: row._id });
                                    });
                                } else {
                                    console.log('In execMultipleStatment task error>>', error);
                                }

                                // call salesforce endpoints to update postgres id into salesforce databse
                                if (salesforceRequestObj.Projects && salesforceRequestObj.Projects.length > 0 ||
                                    salesforceRequestObj.ProjectTasks && salesforceRequestObj.ProjectTasks.length > 0) {
                                    let requestData = {
                                        Data__c: JSON.stringify(salesforceRequestObj)
                                    }
                                    that.postRequestOnSalesforce(Constants.API_END_POINTS.UPDATE_PROJECT_OR_TASK_DETAILS, sessionId, requestData);
                                }
                            });
                        } else {
                            // call salesforce endpoints to update postgres id into salesforce databse
                            if (salesforceRequestObj.Projects && salesforceRequestObj.Projects.length > 0) {
                                let requestData = {
                                    Data__c: JSON.stringify(salesforceRequestObj)
                                };
                                that.postRequestOnSalesforce(Constants.API_END_POINTS.UPDATE_PROJECT_OR_TASK_DETAILS, sessionId, requestData);
                            }
                        }
                    } else {
                        console.log('In execMultipleStatment error>>', error);
                    }
                });
            } else {
                console.log('Nothing to sync..');
            }
        } catch (e) {
            console.log(e);
        }

    }
}