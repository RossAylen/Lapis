#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define the executable name for different OS
EXE_NAME_LINUX="Lapis"
EXE_NAME_WINDOWS="Lapis.exe"

rm -r bin/*

cd src

# Ensure dependencies are up to date
echo "Updating dependencies..."
go mod tidy

# Build for Linux
echo "Building for Linux..."
GOOS=linux GOARCH=amd64 go build -o ../bin/$EXE_NAME_LINUX

# Build for Windows
echo "Building for Windows..."
GOOS=windows GOARCH=amd64 go build -o ../bin/$EXE_NAME_WINDOWS

cp -r plugins ../bin 

echo "Build completed successfully."
