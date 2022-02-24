import { promises as fsPromises } from 'fs';

import core from '@actions/core';

import axios, { AxiosRequestConfig } from 'axios';





const validateInt = (value) => {
	const parsed = parseInt(value);
	if (!isNaN(parsed) && parsed > 0) {
		return parsed;
	}
	return null;
}

const validateStr = (value) => {
	if (typeof value === 'string') {
		if (value.length > 0) {
			return value;
		}
	}
	return null;
}





const fail = (message) => {
	return {
		success: false,
		message,
	}
}





const run = async () => {
	console.log('Validating params...')
	// Get & validate all inputs from the action
	const universeId = validateInt(core.getInput('universe-id'));
	const placeId = validateInt(core.getInput('place-id'));
	const apiKey = validateStr(core.getInput('api-key'));
	const path = validateStr(core.getInput('path'));
	// Check if all inputs are good
	if (!universeId) { return fail('Universe id was not valid') }
	if (!placeId) { return fail('Place id was not valid') }
	if (!apiKey) { return fail('Missing API key') }
	if (!path) { return fail('Missing file path') }
	// Check to make sure we got either a .rbxl or .rbxlx file path
	const isRbxl = path.endsWith('.rbxl')
	const isRbxlx = path.endsWith('.rbxlx')
	if (!(isRbxl || isRbxlx)) {
		return fail('Invalid file format')
	}
	// Try to read the given file path
	console.log('Reading place file...')
	let file
	try {
		file = await fsPromises.readFile(path)
	} catch {
		return fail(`Unable to read file at "${path}"`)
	}
	// Try to publish to the open cloud api
	console.log('Publishing to Roblox...')
	return await (axios({
		method: 'POST',
		url: `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=Published`,
		data: file,
		headers: {
			'Content-Type': (isRbxl ? 'application/octet-stream' : 'application/xml'),
			'x-api-key': apiKey,
		}
	}).then(res => {
		console.log('Parsing response...')
		// Make sure we got a proper response json
		const data = (typeof res.data === 'string') ? JSON.parse(res.data) : res.data
		if (typeof data === 'object') {
			// Check for successful result including version number
			const version = validateInt(data.versionNumber)
			if (version) {
				return {
					success: true,
					message: 'Published!',
					versionNumber: version,
				}
			}
			// Check for error result including code & message
			const code = validateInt(data.code)
			const message = validateStr(data.message)
			if (code && message) {
				return fail(`Failed with error code #${code}: ${message}`)
			}
		}
		// We got some weird undocumented response
		return fail('Unknown response: ' + data)
	}).catch(error => {
		if (error.response) {
			// The request was made and the server responded with
			// a status code that falls out of the range of 2xx
			return fail(error.response.statusText)
		} else if (error.request) {
			// The request was made but no response was received
			return fail('No response from server')
		} else {
			// Something bad happened in setting up
			// the request that triggered an Error
			return fail('Error: ' + error.message);
		}
	}))
}






run().then(res => {
	if (res.success) {
		core.setOutput('success', 'true')
		core.setOutput('message', 'Published!')
		core.setOutput('version-number', res.versionNumber.toString())
	} else {
		core.setOutput('success', 'false')
		core.setOutput('message', res.message)
		core.setOutput('version-number', '-1')
		core.setFailed(res.message)
	}
}).catch(err => {
	core.setOutput('success', 'false')
	core.setOutput('message', err)
	core.setOutput('version-number', '-1')
	core.setFailed(err)
})