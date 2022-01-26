#!/usr/bin/env bash

DATADIR="/mongodumps/shared_volume"
echo "dumping"
until mongodump --host=mongo:27017 -vvv -d sefaria --collection history -o "${DATADIR}/dump"
do
echo "trying to dump history again"
sleep 2
done

until mongodump --host=mongo:27017 -v -d sefaria --collection texts -o "${DATADIR}/dump"
do
echo "trying to dump texts again"
sleep 2
done

until mongodump --host=mongo:27017 -v -d sefaria --collection links -o "${DATADIR}/dump"
do
echo "trying to dump links again"
sleep 2
done

until mongodump --host=mongo:27017 -v -d sefaria --collection sheets -o "${DATADIR}/dump"
do
echo "trying to dump sheets again"
sleep 2
done

until mongodump --host=mongo:27017 -v -d sefaria --excludeCollection=history --excludeCollection=texts --excludeCollection=sheets --excludeCollection=links --excludeCollection=user_history -o "${DATADIR}/dump"
do
echo "trying to dump other stuff again"
sleep 2
done

# exit and restart job if dump fails
#if [ $? -ne 0 ]
#then
#  exit 1
#fi

mkdir /tmp_storage

echo "building full private tar file"
tar cvzf "${DATADIR}/private_dump.tar.gz" -C "${DATADIR}" ./dump

rm "${DATADIR}/dump/sefaria/user_history.bson"
rm "${DATADIR}/dump/sefaria/user_history.metadata.json"

mv "${DATADIR}/dump/sefaria/history.bson" "/tmp_storage/history.bson"
mv "${DATADIR}/dump/sefaria/history.metadata.json" "/tmp_storage/history.metadata.json"

echo "building small private tar file"
tar cvzf "${DATADIR}/private_dump_small.tar.gz" -C "${DATADIR}" ./dump

echo "creating public dump"
until mongodump --host=mongo:27017 -d sefaria -v --collection texts --query '{"license": {"$not": {"$regex": "/^Copyright/i"}}}' -o "${DATADIR}/dump"
do
echo "trying to dump texts again"
sleep 2
done

#if [ $? -ne 0 ]
#then
#  exit 1
#fi

rm "${DATADIR}/dump/sefaria/apikeys.bson"
rm "${DATADIR}/dump/sefaria/apikeys.metadata.json"

rm "${DATADIR}/dump/sefaria/notes.bson"
rm "${DATADIR}/dump/sefaria/notes.metadata.json"

rm "${DATADIR}/dump/sefaria/layers.bson"
rm "${DATADIR}/dump/sefaria/layers.metadata.json"

rm "${DATADIR}/dump/sefaria/sheets.bson"
rm "${DATADIR}/dump/sefaria/sheets.metadata.json"

rm "${DATADIR}/dump/sefaria/locks.bson"
rm "${DATADIR}/dump/sefaria/locks.metadata.json"

rm "${DATADIR}/dump/sefaria/notifications.bson"
rm "${DATADIR}/dump/sefaria/notifications.metadata.json"

rm "${DATADIR}/dump/sefaria/profiles.bson"
rm "${DATADIR}/dump/sefaria/profiles.metadata.json"

rm "${DATADIR}/dump/sefaria/trend.bson"
rm "${DATADIR}/dump/sefaria/trend.metadata.json"

rm "${DATADIR}/dump/sefaria/user_story.bson"
rm "${DATADIR}/dump/sefaria/user_story.metadata.json"

rm "${DATADIR}/dump/sefaria/Copy_of_user_history.bson"
rm "${DATADIR}/dump/sefaria/Copy_of_user_history.metadata.json"

echo "building small public tar file"
tar cvzf "${DATADIR}/dump_small.tar.gz" -C "${DATADIR}" ./dump

mv "/tmp_storage/history.bson" "${DATADIR}/dump/sefaria/history.bson"
mv "/tmp_storage/history.metadata.json" "${DATADIR}/dump/sefaria/history.metadata.json"

echo "building full public tar file"
tar cvzf "${DATADIR}/dump.tar.gz" -C "${DATADIR}" ./dump

echo "upload shoud start"
