const vscode = require('vscode');
require('dotenv').config();
const { spawn } = require('child_process');
const { exec } = require('child_process')
const recorder = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');

const venvExecutablePath = path.join(__dirname, 'venv', process.platform === 'win32' ? 'Scripts\\python' : 'bin/python');
// Define the root path to the virtual environment for activation scripts and pip installations
const venvRootPath = path.join(__dirname, 'venv');

function getGptApiKey() {
    const config = vscode.workspace.getConfiguration('WAV');
    const apiKey = config.get('gptApiKey');
    if (!apiKey) {
        vscode.window.showWarningMessage('GPT API key is not set. Please set it in the extension settings.');
    }
    return apiKey;
}

function setupPythonEnvironment() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Please open a workspace directory before setting up the Python environment.');
        return;
    }

    const requirementsPath = path.join(__dirname, 'requirements.txt');

    // Check if the virtual environment already exists
    if (fs.existsSync(venvRootPath)) {
        vscode.window.showInformationMessage('Python virtual environment already exists.');
    } else {
        // Create the virtual environment
        exec(`python3 -m venv "${venvRootPath}"`, (error) => {
            if (error) {
                vscode.window.showErrorMessage('Failed to create Python virtual environment.');
                console.error(error);
            } else {
                vscode.window.showInformationMessage('Python virtual environment created successfully.');
                vscode.window.showInformationMessage('Now attempting to install required packages (allow 1-2 mins) ... ');

                // Install packages from requirements.txt
                const activateCommand = process.platform === "win32" ? `"${venvRootPath}\\Scripts\\activate"` : `source "${venvRootPath}/bin/activate"`;
                const pipInstallCmd = `${activateCommand} && pip install -r "${requirementsPath}"`;

                exec(pipInstallCmd, { shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash" }, (error) => {
                    if (error) {
                        vscode.window.showErrorMessage('Failed to install Python packages.');
                        console.error(error);
                    } else {
                        vscode.window.showInformationMessage('Python packages installed successfully.');
                    }
                });
            }
        });
    }
}

async function insertCodeAtCursor(code) {
	// Get the active text editor
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("No active text editor.");
		return;
	}

	// Get the current cursor position
	const position = editor.selection.active;

	// Insert the code at the cursor position
	await editor.edit(editBuilder => {
		editBuilder.insert(position, code);
	});

	// Move the cursor to the end of the inserted code
	const newPosition = position.with(position.line + code.split('\n').length - 1, code.length);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    vscode.window.showInformationMessage('WAV is done!');
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Extension "WAV" is now active!');
    
    audioFilePath = "";
    let startAudioRecording = vscode.commands.registerCommand('WAV.startRecording', async function () {
        vscode.window.showInformationMessage('WAV is listening...');

    audioFilePath = path.join(__dirname, 'recorded_audio.wav');
    
    if (fs.existsSync(audioFilePath)) {
        
        try {
            fs.unlinkSync(audioFilePath);
            // vscode.window.showInformationMessage('Previous recording deleted.');
        } catch (err) {
            // vscode.window.showErrorMessage('Failed to delete previous recording.');
            console.error(err);
            return; // Exit if unable to delete the file
        }
    }

    fileStream = fs.createWriteStream(audioFilePath);
    recordingProcess = recorder.record({
        sampleRate: 16000,
        channels: 1,
        format: 'wav',
        recorder: 'sox', // Adjust based on your OS and installation
    });

    recordingProcess.stream().pipe(fileStream);
    recordingProcess.start();
    });

    let stopAudioRecordingAndTranscribe = vscode.commands.registerCommand('WAV.stopRecording', async function () {

        recordingProcess.stop();
        fileStream.end();
        // vscode.window.showInformationMessage(`Recording stopped. Audio saved to ${audioFilePath}`);
        activeEditor = vscode.window.activeTextEditor;
        let fileContent = '';
    
        if (activeEditor) {
            fileContent = activeEditor.document.getText();
        }
        let languageId = 'plaintext'; // Default to plaintext if no editor is open
        if (activeEditor) {
            languageId = activeEditor.document.languageId;
        }
        console.log(fileContent);
        await transcribeAndGenerateCode(audioFilePath, languageId, fileContent);
        
    });
    let disposable = vscode.commands.registerCommand('WAV.setupPythonEnvironment', setupPythonEnvironment);
    context.subscriptions.push(disposable);
    context.subscriptions.push(startAudioRecording,stopAudioRecordingAndTranscribe );
}

async function transcribeAndGenerateCode(audioFilePath, languageId, fileContent) {
    
    const apiKey = getGptApiKey();
    console.log(apiKey)
    const processEnv = Object.assign({}, process.env, { OPENAI_API_KEY: apiKey });
    process.env.OPENAI_API_KEY = apiKey;

    // Assuming you modify your Python script to accept file content as an argument
    // You may need to temporarily save this content to a file or use another method
    // to pass it to the Python script due to command line length limitations.
    const fileContentPath = path.join(__dirname, 'file_content.txt');
    await fs.promises.writeFile(fileContentPath, fileContent);
    // Path to the Python executable and transcription script
    const pythonExecutable = '/opt/homebrew/bin/python3'; // Use 'python3' if 'python' doesn't work for your setup
    const transcriptionScriptPath = path.join(__dirname, 'transcribe.py');

    vscode.window.showInformationMessage('WAV is thinking...');

    // Execute the transcription script with the audio file path
    const transcribeProcess = spawn(venvExecutablePath, [transcriptionScriptPath, audioFilePath, languageId, fileContentPath], {env: processEnv});

    vscode.window.showInformationMessage(transcribeProcess.pid);

    let transcription = '';
    
    transcribeProcess.stdout.on('data', (data) => {
        transcription += data.toString();
    });

    transcribeProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    await new Promise((resolve, reject) => {
        transcribeProcess.on('close', (code) => {
            if (code === 0) {
                console.log("got here")
                vscode.window.showInformationMessage('WAV is coding...');
                const outputFile = path.join(__dirname, 'transcribed_output.txt');
                fs.writeFileSync(outputFile, transcription); // Save transcription
                resolve();
            } else {
                vscode.window.showErrorMessage('WAV hit some rough tides');
                reject(new Error('Transcription process failed'));
            }
        });
    });

    // Now run the gptoutput.py script to generate code from the transcription
    await runGptOutputScript(languageId);
}

async function runGptOutputScript(languageId) {
    const pythonExec = "/opt/homebrew/bin/python3"
    const pyPath = path.join(__dirname, 'gptoutput.py'); // Ensure this is correct

    const gptProcess = spawn(venvExecutablePath, [pyPath, languageId]);

    let generatedCode = ``;
	// insertCodeAtCursor(generatedCode);

    gptProcess.stdout.on('data', (data) => {
        generatedCode += data;
        // code += data.toString();
    });

    gptProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    await new Promise((resolve, reject) => {
        gptProcess.on('close', (code) => {
            if (code === 0) {
                // vscode.window.showInformationMessage('GPT output script completed successfully.');
                insertCodeAtCursor(generatedCode);
                resolve();
            } else {
                // vscode.window.showErrorMessage('GPT output script failed.');
                reject(new Error('GPT output script failed'));
            }
        });
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};

