#!/bin/bash
# Oude ingang; de echte logica staat in deploy/deploy.sh (back-up, migraties, healthcheck, rollback).
exec "$(dirname "$0")/../deploy/deploy.sh" "$@"
