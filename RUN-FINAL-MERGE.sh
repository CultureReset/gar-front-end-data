#!/bin/bash

# FINAL MERGE - RUN THIS TO CONSOLIDATE ALL DATA
# This script merges all data sources into gar-front-end-data
# Creates one unified, clean database

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "🚀 FINAL MERGE - Consolidating ALL data into gar-front-end-data"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

cd /Users/owner/gcr-front-end-data

echo "📊 Starting merge..."
echo ""

node final-merge-everything.js

if [ $? -eq 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════"
  echo "✅ MERGE COMPLETE!"
  echo "═══════════════════════════════════════════════════════════════════════"
  echo ""
  echo "🎯 gar-front-end-data now contains ALL consolidated data:"
  echo "   - All sources merged"
  echo "   - Duplicates consolidated"
  echo "   - All fields combined"
  echo "   - One unified database"
  echo ""
  echo "🚀 Next steps:"
  echo "   1. Restart API: npm start"
  echo "   2. Test with curl: curl http://localhost:3001/api/gcr/entities"
  echo "   3. launching-GCR will display all data"
  echo ""
else
  echo ""
  echo "❌ MERGE FAILED"
  echo "Check the error above"
  echo ""
  exit 1
fi
