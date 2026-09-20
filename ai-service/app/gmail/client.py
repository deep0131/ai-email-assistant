"""
Gmail API client factory.

Builds the Gmail API service object from authorized OAuth credentials.
"""

from googleapiclient.discovery import build

from app.gmail.auth import get_valid_credentials


def get_gmail_service():
    
    creds = get_valid_credentials()
    service = build("gmail", "v1", credentials=creds)
    return service
