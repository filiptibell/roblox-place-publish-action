# Roblox place publishing action

This action publishes a place file to Roblox using the Open Cloud API.

## Inputs

* `universe-id` **Required** The universe id of the place to publish.
* `place-id` **Required** The place id of the place to publish.
* `api-key` **Required** An Open Cloud API key with permissions to publish the place.
* `path` **Required** A path to the place file to publish.

## Outputs

* `success` If publishing was successful or not. Either `true` or `false`.
* `message` An error message if publishing was not successful, or `"Published!"` if successful.
* `version-number` The current version number after a successful publish. Will be `-1` if not successful.

## Example usage

```yaml
uses: filiptibell/roblox-place-publish-action@v2.0
with:
  universe-id: '123456'
  place-id: '1234567890'
  api-key: ${{ secrets.CLOUD_API_KEY }}
  path: 'place.rbxl'
```
