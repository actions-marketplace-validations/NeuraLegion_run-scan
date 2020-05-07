import * as core from "@actions/core";
import * as rm from "typed-rest-client/RestClient";

const apiToken = core.getInput("api_token");
const restartScanID = core.getInput("restart_scan");
const name = core.getInput("name");
const fileId = core.getInput("file_id");
const crawlerUrls = getArray("crawler_urls");
const discoveryTypes_in = getArray("discovery_types");
const module_in = core.getInput("module");
const hostsFilter = getArray("hosts_filter");
const type = core.getInput("type");
const hostname = core.getInput("hostname");

function getArray(name: string): string[] | null {
  const input = core.getInput(name);

  try {
    const elements = JSON.parse(input);

    if (elements instanceof Array) {
      return elements.length == 0 ? null : elements;
    } else {
      return null;
    }
  } catch (err) {
    core.debug(name + " failed: " + err.message + " => " + input);
    return null;
  }
}

const baseUrl = hostname ? `https://$hostname` : "https://nexploit.app";
let restc: rm.RestClient = new rm.RestClient("GitHub Actions", baseUrl);

interface Scan {
  id: string;
}

async function retest(
  token: string,
  uuid: string,
  name?: string
): Promise<string> {
  let scan_name = name || "GitHub Actions";

  try {
    let options = { additionalHeaders: { Authorization: `Api-Key ${token}` } };
    let restRes: rm.IRestResponse<Scan> = await restc.create<Scan>(
      `api/v1/scans/${uuid}/retest`,
      { name: scan_name },
      options
    );

    switch (restRes.statusCode) {
      case 201: {
        let url = `https://nexploit.app/scans/${restRes.result?.id}`;
        console.log(`Success. Scan was created on ${url}`);
        core.setOutput("url", url);
        return Promise.resolve(restRes.result!.id);
      }
      case 400: {
        core.setFailed("Failed to run scan");
        break;
      }
      case 401: {
        core.setFailed("Failed to log in with provided credentials");
        break;
      }
      case 403: {
        core.setFailed(
          "The account doesn't have any permissions for a resource"
        );
        break;
      }
    }
  } catch (err) {
    core.setFailed("Failed: " + err.message);
  }

  return Promise.reject();
}

interface NewScan {
  name: string;
  discoveryTypes: string[] | null;
  module: string | null;
  crawlerUrls: string[] | null;
  fileId: string | null;
  hostsFilter: string[] | null;
}

async function create(token: string, scan: NewScan): Promise<string> {
  try {
    console.debug(scan);
    let options = { additionalHeaders: { Authorization: `Api-Key ${token}` } };
    let restRes: rm.IRestResponse<Scan> = await restc.create<Scan>(
      "api/v1/scans/",
      scan,
      options
    );

    switch (restRes.statusCode) {
      case 201: {
        let url = `https://nexploit.app/scans/${restRes.result?.id}`;
        console.log(`Success. Scan was created on ${url}`);
        core.setOutput("url", url);
        return Promise.resolve(restRes.result!.id);
      }
      case 400: {
        core.setFailed("Failed to run scan");
        return Promise.reject("Failed to run scan");
      }
      case 401: {
        core.setFailed("Failed to log in with provided credentials");
        return Promise.reject("Failed to log in with provided credentials");
      }
      case 403: {
        core.setFailed(
          "The account doesn't have any permissions for a resource"
        );
        return Promise.reject(
          "The account doesn't have any permissions for a resource"
        );
      }
    }
  } catch (err) {
    core.setFailed("Failed: " + err.message);
  }

  return Promise.reject();
}

interface Status {
  status: string;
  issuesBySeverity: IssuesBySeverity[];
}

interface IssuesBySeverity {
  number: number;
  type: string;
}

async function getStatus(token: string, uuid: string): Promise<Status> {
  try {
    let options = { additionalHeaders: { Authorization: `Api-Key ${token}` } };
    let restRes: rm.IRestResponse<Status> = await restc.get<Status>(
      `api/v1/scans/${uuid}`,
      options
    );
    const status: Status = {
      status: restRes.result!.status,
      issuesBySeverity: restRes.result!.issuesBySeverity,
    };

    switch (restRes.statusCode) {
      case 200: {
        return Promise.resolve(status);
      }
      case 401: {
        core.setFailed("Failed to log in with provided credentials");
        break;
      }
      case 403: {
        core.setFailed(
          "The account doesn't have any permissions for a resource"
        );
        break;
      }
    }
  } catch (err) {
    console.debug("Timeout reached");
  }

  return Promise.reject();
}

if (restartScanID) {
  if (
    !(
      fileId ||
      crawlerUrls ||
      discoveryTypes_in ||
      module_in ||
      hostsFilter ||
      type
    )
  ) {
    retest(apiToken, restartScanID, name);
  } else {
    core.setFailed(
      "You don't need parameters, other than api_token, restart_scan and name, if you just want to restart an existing scan"
    );
  }
} else {
  const module = module_in || "core";
  const discoveryTypes = discoveryTypes_in || ["archive"];

  create(apiToken, {
    name,
    discoveryTypes,
    module,
    crawlerUrls,
    fileId,
    hostsFilter,
  });
}
