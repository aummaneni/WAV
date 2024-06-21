from openai import OpenAI
import sys
import os
import re
from dotenv import load_dotenv

load_dotenv()

# Initialize the OpenAI client

API_KEY = os.getenv('OPENAI_API_KEY')
language_id = sys.argv[1] if len(sys.argv) > 1 else "plaintext"
dname = os.path.dirname(__file__)
file_content_path = os.path.join(dname, 'file_content.txt')  # The path to the file containing the editor's content

with open(file_content_path, 'r') as file:
    file_content = file.read()
client = OpenAI(api_key=API_KEY)

def read_transcribed_text():
    # file_path = "./"
    dirname = os.path.dirname(__file__)
    file_path = os.path.join(dirname, 'transcribed_output.txt')
    """Reads the transcribed text from a specified file."""
    with open(file_path, 'r') as file:
        return file.read().strip()

# Function to call the API and save the output to a file
def call_api_and_save_output(user_input):
    
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": f"You are an advanced AI programming assistant designed to interpret spoken language descriptions of code and translate them into syntactically correct programming code. Your expertise includes identifying and transforming verbal descriptions of programming constructs, such as loops, conditionals, variable assignments, and arithmetic operations, into executable code in a variety of programming languages. You prioritize translating spoken language that describes code structures and logic, ensuring the generated code is accurate and functional. You also understand and process general spoken instructions about programming tasks, converting them into code. Write in the language ${language_id}, or if it is in plaintext write in Python. The current code in the file contents are '${file_content}', if referenced in the transcription by the user, generate code that acts only as an addition that may use present code but DO NOT GENERATE CODE THAT IS ALREADY PRESENT IN THE FILE CONTENTS. If the user prompts a completion of a function signature that is already be present in the file, complete only the function contents, not the signature. Return nothing but the code itself, output 'err' if there is no code-based language."},
            {"role": "user", "content": user_input}
        ]
    )

    # Assuming completion.choices[0].message contains the desired output
    output_code = completion.choices[0].message.content
    cleaned_output_code = re.sub(r'^```[a-zA-Z]+\s+', '', output_code)  # Remove starting ```language
    cleaned_output_code = re.sub(r'```$', '', cleaned_output_code)

    # Define the path to the output file (adjust the path as necessary)
    dirname = os.path.dirname(__file__)
    output_file_path = os.path.join(dirname, 'output.txt')
    # output_file_path = '/Users/aummaneni/hackillinois/'

    # Open the file in append mode and write the output
    with open(output_file_path, 'w') as file:
        file.write(str(cleaned_output_code))  # Add a newline for readability between entries

    print(cleaned_output_code)
    return cleaned_output_code


# Example usage
if __name__ == "__main__":
    # Read the transcribed text from the file
    transcribed_text = read_transcribed_text()
    # Call the API with the transcribed text
    call_api_and_save_output(transcribed_text)
