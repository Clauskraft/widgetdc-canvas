import sys
import os
import json
from notebooklm import NotebookLMClient

def sync():
    # Load configuration
    config_dir = os.path.join(os.path.expanduser("~"), ".widget-tdc")
    if not os.path.exists(config_dir):
        os.makedirs(config_dir)
    
    config_path = os.path.join(config_dir, "notebooklm_config.json")
    if not os.path.exists(config_path):
        print(json.dumps({"success": False, "error": "Configuration missing. Please set your __Secure-1PSID cookie."}))
        return

    with open(config_path, "r") as f:
        config = json.load(f)

    cookie = config.get("__Secure-1PSID")
    if not cookie:
        print(json.dumps({"success": False, "error": "Cookie missing in configuration."}))
        return

    try:
        client = NotebookLMClient(sid=cookie)
        
        # 1. FIND OR CREATE NOTEBOOK
        notebooks = client.list_notebooks()
        target_notebook = None
        for nb in notebooks:
            if nb.title == "WidgeTDC Strategy Station":
                target_notebook = nb
                break
        
        if not target_notebook:
            target_notebook = client.create_notebook("WidgeTDC Strategy Station")

        # 2. HANDLE "ASK" MODE (Grounded Query)
        if len(sys.argv) > 1 and sys.argv[1] == "--ask":
            query = sys.argv[2] if len(sys.argv) > 2 else ""
            if not query:
                print(json.dumps({"success": False, "error": "Query empty."}))
                return
            
            # Use the chat method of the notebook/client
            response = client.ask(target_notebook.id, query)
            print(json.dumps({"success": True, "answer": response.content}))
            return

        # 3. HANDLE SYNC MODE (Default)
        docs_dir = os.path.join(os.path.expanduser("~"), "Documents", "NotebookLM")
        if os.path.exists(docs_dir):
            files = [f for f in os.listdir(docs_dir) if f.endswith(".md") or f.endswith(".pdf")]
            for file_name in files:
                file_path = os.path.join(docs_dir, file_name)
                client.add_source(target_notebook.id, file_path)

        print(json.dumps({"success": True, "notebook_id": target_notebook.id}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    sync()
