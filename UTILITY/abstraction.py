"""
This file is generally for the purpose of holding reused codes or logics
"""


import json

from django.db import connection, reset_queries
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse


def count_queries():
    """
    This return the formated database to and fro count for analysis, reused inside every view during test
    Check for debug mode first
    TODO: brb
    """
    if settings.DEBUG == False: return
    
    
    
    
##############################################

# THIS IS FOR KNOWING THE IP COMING FROM THE REQUEST - NB: This can be swapped with anything sice its only used byt the rate limtiing itselg
# I CAN DECIDE TO CHANGE FROM HERE WETHER TO NOT USE IP BAN AND USE SOMETHING ELSE

#############################################
    
def _client_ip(request):
    """
    Look for the client IP adress to ban.
    Now some issue of render load balancer so give REMOTE_ADDR to be only a fallback and HTTP_X_FORWARED is the main one
    difference? X.. append all ip since the request was mad down to the last load balancer ip
    issue, attacker can spoof this but i no get choice since render uses a load balancer
    """
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()  #   Get the very first IP
    return request.META.get('REMOTE_ADDR', 'unknown')


##############################################

# THIS IS FOR RATE LIMTIING
# LOOK IN THE CACHE FOR THE KEY

#############################################
def _rate_limited(key_prefix, request, limit=5, window_seconds=60):
    """
    Used the ip addr from _client_ip to enforce rat limit, the only issue; this might no work
    because if the attacker append data to their x-for.. data then they will bypass it
    but incase x=for.. is nto found, default to just use the immediate rrquest sender(remote_a...)
    """
    key = f'{key_prefix}:{_client_ip(request)}'
    count = cache.get(key, 0)
    if count >= limit:
        #reset the counter
        cache.set(key, count + 1, timeout=window_seconds)
        return True
    cache.set(key, count + 1, timeout=window_seconds)
    return False


##############################################

# THIS IS FOR Parsing INCOMING DATA AS I HAVE MADE AGREEMENT WITH MY FRONEND TO USE JSONRESPONSE ISTEAD OF FORM DATA
# I CAN DECIDE TO CHANGE FROM HERE WETHER TO NOT USE IP BAN AND USE SOMETHING ELSE

#############################################
def _parse_json_body(request):
    """Every view here expects a JSON body. A
    tiny helper so each view doesn't repeat the same try/except."""
    try:
        return json.loads(request.body or b'{}'), None
    except json.JSONDecodeError:
        return None, JsonResponse({'message': 'Malformed request body.'}, status=400)

