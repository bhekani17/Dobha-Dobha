"""Verify generated API authorization offline using the pinned SAM translator."""

from pathlib import Path
from samtranslator.yaml_helper import yaml_parse
from samtranslator.translator.transform import transform

class OfflinePolicies:
    def load(self):
        return {}

source = Path(__file__).resolve().parents[1] / 'template.yaml'
template = yaml_parse(source.read_text())
# CloudFormation receives packaged S3 CodeUris. Substitute a synthetic URI for
# translation only; no artifact is uploaded or read.
for resource in template['Resources'].values():
    if resource['Type'] == 'AWS::Serverless::Function':
        resource['Properties']['CodeUri'] = 's3://synthetic-artifacts/fixture.zip'
result = transform(template, {}, OfflinePolicies())
paths = result['Resources']['MarketApi']['Properties']['Body']['paths']
for path, methods in {
    '/api/items': ['post'],
    '/api/items/{itemId}': ['patch', 'delete'],
    '/api/items/mine': ['get'],
    '/api/me': ['get', 'patch', 'delete'],
    '/api/{proxy+}': ['get', 'post', 'patch', 'put', 'delete'],
}.items():
    for method in methods:
        security = paths[path][method].get('security')
        assert security == [{'CognitoAuthorizer': []}], (path, method, security)
public_methods = {
    ('/api/items', 'get'), ('/api/items/{itemId}', 'get'), ('/api/health', 'get'),
    ('/api/media/{proxy+}', 'get'), ('/api/rooms', 'get'), ('/api/live/token', 'get'),
    ('/api/auth/{proxy+}', 'post'),
}
for path, methods in paths.items():
    for method, definition in methods.items():
        assert method in {'get', 'post', 'patch', 'put', 'delete'}, (path, method)
        expected = [] if (path, method) in public_methods else [{'CognitoAuthorizer': []}]
        assert definition.get('security', []) == expected, (path, method, definition.get('security'))

assert result['Resources']['ApiCachePolicy']['Properties']['CachePolicyConfig']['MaxTTL'] == 0
print('SAM transformation passed: public browsing, protected listing/account writes and authenticated catch-all are configured; API caching is disabled.')
