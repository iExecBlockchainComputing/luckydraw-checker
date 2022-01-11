const fsPromises = require("fs/promises");
const ethers = require("ethers");
const Big = require("big.js");
const { request, gql } = require("graphql-request");
const { Parser } = require("json2csv");

const check = async () => {
  const drawsQuery = gql`
    query {
      deals(
        first: 1000
        where: {
          app: "0xb9b56f1c78f39504263835342e7affe96536d1ea"
          params_contains: "/ipfs/QmXPTQuHFC3shWibKByVKQWcCStrLeBbyFgtyjYjxk5nSD"
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        dealid: id
        timestamp
        requester {
          address: id
        }
        tasks {
          resultsCallback
        }
      }
    }
  `;
  try {
    const res = await request(
      "https://thegraph.viviani.iex.ec/subgraphs/name/viviani/poco-v5",
      drawsQuery
    );

    if (res.deals.length > 999) {
      console.warn(
        "WARN: more than 1000 results found, only the latest 1000 will be processed!"
      );
    }

    console.log(res.deals.length, "results found");
    const formatedRes = res.deals
      .filter(
        (r) =>
          r.dealid &&
          r.requester &&
          r.requester.address &&
          r.timestamp &&
          r.tasks &&
          r.tasks[0] &&
          r.tasks[0].resultsCallback
      )
      .map((r) => {
        const [oracleid, time, bytes] = ethers.utils.defaultAbiCoder.decode(
          ["bytes32", "uint256", "bytes"],
          r.tasks[0].resultsCallback
        );
        const [bnVal] = ethers.utils.defaultAbiCoder.decode(["int256"], bytes);
        const value = new Big(bnVal).times(new Big("1e-18")).toString();
        return {
          address: r.requester.address,
          date: new Date(r.timestamp * 1000),
          value,
          deal: r.dealid,
        };
      });

    console.log(formatedRes.length, "valid results");

    const csvParser = new Parser({ fields: Object.keys(formatedRes[0]) });
    const csvData = csvParser.parse(formatedRes);

    await fsPromises.writeFile("report.csv", csvData);

    console.log("report.csv created");
  } catch (err) {
    console.log("an error occured:", err);
  }
};

check();
