package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

//go:embed notesApp.html
var mainPage string

func rootHandler(w http.ResponseWriter, r *http.Request) {
  io.WriteString(w, mainPage)
}

type Note map[string]string

var Notes map[string]string 

func saveHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Save note handler...")
  var note Note;
  err := json.NewDecoder(r.Body).Decode(&note)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
    fmt.Println("Error decoding note", err.Error())
		return
	}
  
  for title, content := range note {
    if title == ""{ 
      fmt.Println("Note title == \"\", returning...")
      return 
    }
    filename := title + ".html"
    dir := filepath.Dir(filename)
    if err = os.MkdirAll(dir, os.ModePerm); err != nil {
      fmt.Println(err.Error())
      return
    }
    err = os.WriteFile(filename, []byte(content), 0777)
    if err != nil {
      fmt.Println(err.Error())
    }
    Notes[title] = content 
    fmt.Println("Note \"" + title + "\" has been saved")
  }
}

func loadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Notes)
}

func deleteHandler(w http.ResponseWriter, r *http.Request){
  fmt.Println("Delete note handler...")
  body, err := io.ReadAll(r.Body)
  if err != nil {
      http.Error(w, "Error reading name", http.StatusInternalServerError)
      fmt.Println("Error reading name")
      return
  }
  defer r.Body.Close()
  name := string(body);
  delete(Notes, name)
  filename := name + ".html"
  err = os.Remove(filename)
  if err != nil {
    fmt.Println(err)
    return
  }
  fmt.Println("Note \"", name, "\" has been deleted")
}

func ReadNotesFromDisk(){
  fmt.Println("Reading Notes from disk")
	root := "./"
	fileSystem := os.DirFS(root)
	fs.WalkDir(fileSystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
      log.Fatal(err)
		}
		if strings.HasSuffix(path, ".html") {
      fmt.Println(path)
			content, err := os.ReadFile(root + "/" + path)
			if err != nil {
				fmt.Println(err.Error())
				return nil 
			}
			Notes[strings.TrimSuffix(path, ".html")] = string(content)
		}
		return nil
	})
}

func main() {
  Notes = make(map[string]string)
  ReadNotesFromDisk()
  mux := http.NewServeMux()
  mux.HandleFunc("/delete", deleteHandler)
  mux.HandleFunc("/load", loadHandler)
  mux.HandleFunc("/save", saveHandler)
  mux.Handle("/plugins/", http.StripPrefix("/plugins/", http.FileServer(http.Dir("./plugins"))))
  mux.HandleFunc("/", rootHandler)
  var location = "127.0.0.1:8082";
  log.Println("CTRL + Click -> ", "http://" + location)
  err := http.ListenAndServe(location, mux)
	if err != nil {
		log.Fatal(err)
	}
}
