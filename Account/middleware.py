from django.conf import settings
from django.http import JsonResponse


class MaintanceMiddleWare:
    def __init__(self, get_response):
        self.get_response = get_response #THIS IS THE OUTGOING RESPONSE THAT THE NEXT MDDILEWARE WILL RECEIVE
        
    def __call__(self, request, *args, **kwds):
        if not getattr(settings, 'SERVICE_MODE'):
            return JsonResponse({'message': 'MAINTANCE MODE, PLEASE CHECK BACK LATER'}, status = 503)
        return self.get_response(request)   #Collect the response and pass it to the next person