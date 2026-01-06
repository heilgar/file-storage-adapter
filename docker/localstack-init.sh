#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until aws --endpoint-url=http://localhost:4566 s3 ls 2>/dev/null; do
    echo "Waiting for LocalStack..."
    sleep 2
done

echo "LocalStack is ready! Creating S3 bucket..."

# Create S3 bucket using AWS CLI
aws --endpoint-url=http://localhost:4566 s3 mb s3://local-storage-bucket

if [ $? -eq 0 ]; then
    echo "S3 bucket 'local-storage-bucket' created successfully!"
else
    echo "Failed to create S3 bucket!"
fi
