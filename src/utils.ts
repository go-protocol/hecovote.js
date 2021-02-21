import { Interface } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import Ajv from 'ajv';
import { abi as multicallAbi } from './abi/Multicall.json';
import _strategies from './strategies';
import Multicaller from './utils/multicaller';
import getProvider from './utils/provider';
import {
  decodeContenthash,
  validateContent,
  isValidContenthash,
  encodeContenthash,
  resolveENSContentHash,
  resolveContent
} from './utils/contentHash';
import { signMessage, getBlockNumber } from './utils/web3';

export const MULTICALL = {
  '128': '0x37ab26db3df780e7026f3e767f65efb739f48d8e',
  '256': '0xC33994Eb943c61a8a59a918E2de65e03e4e385E0',
};

export const SNAPSHOT_SUBGRAPH_URL = {
  '1': 'https://api.thegraph.com/subgraphs/name/snapshot-labs/snapshot',
  '4': 'https://api.thegraph.com/subgraphs/name/snapshot-labs/snapshot-rinkeby',
  '42': 'https://api.thegraph.com/subgraphs/name/snapshot-labs/snapshot-kovan'
};

export async function call(provider, abi: any[], call: any[], options?) {
  const contract = new Contract(call[0], abi, provider);
  try {
    const params = call[2] || [];
    return await contract[call[1]](...params, options || {});
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function multicall(
  network: string,
  provider,
  abi: any[],
  calls: any[],
  options?
) {
  const multi = new Contract(MULTICALL[network], multicallAbi, provider);
  const itf = new Interface(abi);
  try {
    const [, res] = await multi.aggregate(
      calls.map((call) => [
        call[0].toLowerCase(),
        itf.encodeFunctionData(call[1], call[2])
      ]),
      options || {}
    );
    return res.map((call, i) => itf.decodeFunctionResult(calls[i][1], call));
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function subgraphRequest(url: string, query, options: any = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: JSON.stringify({ query: jsonToGraphQLQuery({ query }) })
  });
  const { data } = await res.json();
  return data || {};
}

export async function getSapceExist(id: string) {
  const provider = id.includes('.heco') ? getProvider('128') : getProvider('256')
  const contractAddress = id.includes('.heco') ? '0xC403190d6155cd2A44fBe80A09c23cf3707B1B69' : '0xB14C5711db68081C52C5Bf6825741Bd28B3255d1'
  const abi = [{
    inputs: [{
      internalType: "string",
      name: "name",
      type: "string"
    }],
    name: "spaceExist",
    outputs: [{
      internalType: "bool",
      name: "",
      type: "bool"
    }],
    stateMutability: "view",
    type: "function"
  }]
  return await call(provider, abi, [
    contractAddress,
    'spaceExist',
    [id]
  ]);
}

export async function getSapce(id: string) {
  const provider = id.includes('.heco') ? getProvider('128') : getProvider('256')
  const contractAddress = id.includes('.heco') ? '0xC403190d6155cd2A44fBe80A09c23cf3707B1B69' : '0xB14C5711db68081C52C5Bf6825741Bd28B3255d1'
  const abi = [{
		inputs: [
			{
				internalType: "string",
				name: "name",
				type: "string"
			}
		],
		name: "getSpace",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	}]
  return await call(provider, abi, [
    contractAddress,
    'getSpace',
    [id]
  ]);
}

export async function fleekGet(
  address: string,
  id: string
) {
  const url = `https://fankouzu-team-bucket.storage.fleek.co/registry/${address}/${id}`;
  return fetch(url).then((res) => res.json());
}

export async function ipfsGet(
  gateway: string,
  ipfsHash: string,
  protocolType: string = 'ipfs'
) {
  const url = `https://${gateway}/${protocolType}/${ipfsHash}`;
  return fetch(url).then((res) => res.json());
}

export async function sendTransaction(
  web3,
  contractAddress: string,
  abi: any[],
  action: string,
  params: any[],
  overrides = {}
) {
  const signer = web3.getSigner();
  const contract = new Contract(contractAddress, abi, web3);
  const contractWithSigner = contract.connect(signer);
  // overrides.gasLimit = 12e6;
  return await contractWithSigner[action](...params, overrides);
}

export async function getScores(
  space: string,
  strategies: any[],
  network: string,
  provider,
  addresses: string[],
  snapshot = 'latest'
) {
  try {
    return await Promise.all(
      strategies.map((strategy) =>
        snapshot !== 'latest' && strategy.params?.start > snapshot
          ? {}
          : _strategies[strategy.name](
            space,
            network,
            provider,
            addresses,
            strategy.params,
            snapshot
          )
      )
    );
  } catch (e) {
    return Promise.reject(e);
  }
}

export function validateSchema(schema, data) {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return valid ? valid : validate.errors;
}

export default {
  call,
  multicall,
  subgraphRequest,
  ipfsGet,
  fleekGet,
  getSapceExist,
  getSapce,
  sendTransaction,
  getScores,
  validateSchema,
  getProvider,
  decodeContenthash,
  validateContent,
  isValidContenthash,
  encodeContenthash,
  resolveENSContentHash,
  resolveContent,
  signMessage,
  getBlockNumber,
  Multicaller
};
