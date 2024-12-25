const vscode = require('vscode');
const axios = require('axios').default;

/**
 * @param {vscode.ExtensionContext} context
 */

class ApiServices {
	#baseUrl = "https://api.sort-me.org/";

	constructor() {
		this.token = vscode.workspace.getConfiguration("sortme").get("token");
		this.options = {
			headers: {
				"authorization": `Bearer ${this.token}`,
				"Content-Type": "application/json"
			}
		};
	}

	async getContestList() {
		const { data } = await axios.get(
			`${this.#baseUrl}getUpcomingContests`,
			this.options
		).catch((error) => {
			console.log(error);
		});

		return data;
	}

	async getContest(constest_id) {
		const { data } = await axios.get(
			`${this.#baseUrl}getContestTasks?id=${constest_id}`,
			this.options
		).catch((error) => {
			console.log(error);
		});

		return data;
	}
}

class ContestRepository {
	constructor() {
		this.contestList = [];
		this.contestData = new Map();
		this.apiServices = new ApiServices();
	}

	async getContestList() {
		if (this.contestList.length === 0) {
			this.contestList = await this.apiServices.getContestList();
		}
		return this.contestList;
	}

	async getContest(constest_id) {
		if (!this.contestData.has(constest_id)) {
			this.contestData.set(constest_id, await this.apiServices.getContest(constest_id));
		}

		return this.contestData.get(constest_id);
	}
}

async function activate(context) {
	const contestRepository = new ContestRepository();

	const executeTest = (terminal, data) => {
		const compileCommand = vscode.workspace
			.getConfiguration("sortme").get("cpp.compile_command");

		const fileName = vscode.window.activeTextEditor.document.fileName;

		terminal.show(false);
		const execution = terminal.shellIntegration.executeCommand(`${compileCommand} ${fileName}; ./out`);

		vscode.window.onDidStartTerminalShellExecution(event => {
			if (event.execution === execution) {
				event.shellIntegration.executeCommand(data.samples[0].in);
			}
		});

		vscode.window.onDidEndTerminalShellExecution(event => {
			if (event.execution === execution) {
				console.log(`Command exited with code ${event.exitCode}`);
			}
		});
	}

	const sortmeCommand = vscode.commands.registerCommand('inverterplugin.sortme_run', async function () {
		const contestList = await contestRepository.getContestList();
		const contest = vscode.window.showQuickPick(
			contestList.map(item => { return { id: item.id, label: item.name } }));

		contest.then(async (data) => {
			let contestData = await contestRepository.getContest(data.id);

			const task = vscode.window.showQuickPick(
				contestData.tasks.map(item => { return { label: item.name, ...item } }));

			task.then((data) => {
				let terminal = vscode.window.activeTerminal;
				let terminalIntegration = undefined;

				if (terminal && terminal.shellIntegration) {
					executeTest(terminal, data);
				} else {
					if (terminal) {
						terminal.dispose();
					}
					terminalIntegration = undefined;

					terminal = vscode.window.createTerminal("SortMe terminal");

					vscode.window.onDidChangeTerminalShellIntegration(async (event) => {
						if (terminal === event.terminal) {
							if (!terminalIntegration) {
								terminalIntegration = event.terminal.shellIntegration;

								executeTest(terminal, data);
							}
						}
					});
				}
			});
		});
	});

	context.subscriptions.push(sortmeCommand);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
