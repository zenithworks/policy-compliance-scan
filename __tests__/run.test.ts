import { run } from '../src/run';
import * as core from '@actions/core';
import * as tokenGenerator from '../src/AzCLIAADTokenGenerator'
import { mocked } from 'ts-jest/utils';
import * as scanHelper from '../src/scanHelper'
import * as fileHelper from '../src/fileHelper'
import * as client from '../src/client'
import { scryptSync } from 'crypto';
import * as resultScanner from '../src/resultScanner';
   
const mockedFileHelper = require('../src/fileHelper');    
mockedFileHelper.getPolicyScanDirectory = jest.fn().mockImplementation(() =>{        return 'test/_temp/containerscan_123';    });

const coreMock = mocked(core, true);
const tokenGeneratorMock = mocked(tokenGenerator, true);
const clientMock = mocked(client, true);
const fileHelperMock = mocked(fileHelper, true);
const scanHelperMock = mocked(scanHelper, true);
const resultScannerMock = mocked(resultScanner, true);

test("triggerScan() - correct scope uri is triggered", async () => {
    let scopes = '/scope';
    coreMock.getInput = jest.fn().mockReturnValue(scopes);

    tokenGeneratorMock.getAccessToken = jest.fn().mockResolvedValue("token");
    clientMock.sendRequest = jest.fn().mockImplementation(() =>
    {
        let WebResponse = new client.WebResponse();
        WebResponse.headers = {
            'location': `${scopes}`
        }
        return Promise.resolve(WebResponse);
    });

    // invoke and assert 
    await expect(scanHelper.triggerOnDemandScan()).resolves.not.toThrow();


    expect(clientMock.sendRequest.mock.calls[0][0]['uri']).toEqual('https://management.azure.com/scope/providers/Microsoft.PolicyInsights/policyStates/latest/triggerEvaluation?api-version=2019-10-01');

});

test("triggerScan() - correct scopes uri is triggered", async () => {
    let scopes = '/subscriptions/1234\n/subscriptions/2345';
    coreMock.getInput = jest.fn().mockReturnValue(scopes);

    tokenGeneratorMock.getAccessToken = jest.fn().mockResolvedValue("token");
    clientMock.sendRequest = jest.fn().mockImplementation(() =>
    {
        let WebResponse = new client.WebResponse();
        WebResponse.headers = {
            'location': `${scopes}`
        }
        return Promise.resolve(WebResponse);
    });

    // invoke and assert 
    await expect(scanHelper.triggerOnDemandScan()).resolves.not.toThrow();


    expect(clientMock.sendRequest.mock.calls[0][0]['uri']).toEqual('https://management.azure.com/subscriptions/1234/providers/Microsoft.PolicyInsights/policyStates/latest/triggerEvaluation?api-version=2019-10-01');
    expect(clientMock.sendRequest.mock.calls[1][0]['uri']).toEqual('https://management.azure.com/subscriptions/2345/providers/Microsoft.PolicyInsights/policyStates/latest/triggerEvaluation?api-version=2019-10-01');

});

test("pollForCompletion() - use poll location returned by triggerScan", async () => {
    //Mock
    let scopes = '/subscriptions/1234';
    coreMock.getInput = jest.fn().mockReturnValue(scopes);
    tokenGeneratorMock.getAADToken = jest.fn().mockResolvedValue('{"accessToken":"awdwd", "expiresOn":"20-07-20"}');

    clientMock.sendRequest = jest.fn().mockImplementation(() =>
    {
        let WebResponse = new client.WebResponse();
        WebResponse.headers = {
            'location': `${scopes}polllocation`
        }
        return Promise.resolve(WebResponse);
    });

    scanHelperMock.pollForCompletion = jest.fn().mockResolvedValue('');
    fileHelperMock.getScanReportPath = jest.fn().mockReturnValue('');
    fileHelperMock.getFileJson = jest.fn().mockReturnValue(null);

    //Invoke and assert
    await expect(run()).resolves.not.toThrow();
    expect(scanHelperMock.pollForCompletion.mock.calls).toEqual([
        [[{
            "pollLocation": "/subscriptions/1234polllocation",
            "scope": "/subscriptions/1234"
            }
        ]]
    ]);
});

test("printFormattedOutput - called with the result from scan report", async () => {
    //Mock
    let scopes = '/subscriptions/1234';
    coreMock.getInput = jest.fn().mockReturnValue(scopes);
    scanHelperMock.triggerOnDemandScan = jest.fn().mockResolvedValue('');
    scanHelperMock.pollForCompletion = jest.fn().mockResolvedValue('');
    fileHelperMock.getScanReportPath = jest.fn().mockReturnValue('');
    fileHelperMock.getFileJson = jest.fn().mockReturnValue([1,2,3]);
    resultScannerMock.printFormattedOutput = jest.fn().mockReturnValue([5,6,7]);
    resultScannerMock.createCSV = jest.fn();

    //Invoke and assert
    await expect(run()).resolves.not.toThrow();
    expect(resultScannerMock.printFormattedOutput).toBeCalledWith([1,2,3],expect.anything(),expect.anything());
});


test("createCSV - to be called when skip-artifacts is false", async () => {
    //Mock
    let scopes = '/subscriptions/1234';
    coreMock.getInput = jest.fn().mockReturnValue(scopes);
    scanHelperMock.triggerOnDemandScan = jest.fn().mockResolvedValue('');
    scanHelperMock.pollForCompletion = jest.fn().mockResolvedValue('');
    fileHelperMock.getScanReportPath = jest.fn().mockReturnValue('');
    fileHelperMock.getFileJson = jest.fn().mockReturnValue([1,2,3]);
    resultScannerMock.printFormattedOutput = jest.fn().mockReturnValue([5,6,7]);
    resultScannerMock.createCSV = jest.fn();

    //Invoke and assert
    await expect(run()).resolves.not.toThrow();
    expect(resultScannerMock.createCSV).toBeCalled();
});

test("createCSV - not to be called when skip-artifacts is true", async () => {
    //Mock
    let scopes = '/subscriptions/1234';
    coreMock.getInput = jest.fn().mockImplementation((name) => {
        if (name == 'skip-artifacts') {
            return 'true';
        }
        return scopes;
    });
    scanHelperMock.triggerOnDemandScan = jest.fn().mockResolvedValue('');
    scanHelperMock.pollForCompletion = jest.fn().mockResolvedValue('');
    fileHelperMock.getScanReportPath = jest.fn().mockReturnValue('');
    fileHelperMock.getFileJson = jest.fn().mockReturnValue([1,2,3]);
    resultScannerMock.printFormattedOutput = jest.fn().mockReturnValue([5,6,7]);
    resultScannerMock.createCSV = jest.fn();

    //Invoke and assert
    await expect(run()).resolves.not.toThrow();
    expect(resultScannerMock.createCSV).toBeCalledTimes(0);
});