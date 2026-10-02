import json
from urllib.request import Request, urlopen


if __name__ == "__main__":
    try:
        while True:
            question = input("Ask anything: ")
            if question == "exit":
                break
            if not question:
                continue
            body = json.dumps({"question": question}).encode()
            request = Request(
                "http://localhost:8000/ask",
                data=body,
                headers={"Content-Type": "application/json"},
            )
            response = json.load(urlopen(request))
            answer = response['answer'].splitlines()
            print()
            print("BOT: ", end="")
            for line in answer:
                print(line)
            print()
    except KeyboardInterrupt:
        print()