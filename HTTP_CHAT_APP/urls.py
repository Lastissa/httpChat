
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import path, include, reverse
from django.views.decorators.cache import cache_control

from Account.sitemaps import StaticAccountViewSitemap
from UTILITY.Static import static

sitemaps = {
    'account_pages': StaticAccountViewSitemap,
}


# --- SEO: robots.txt -------------------------------------------------
@cache_control(max_age=86400)  # crawlers refetch this constantly; a day's caching is plenty
def robots_txt(request):
    base = static.project_base_url.rstrip('/')
    lines = [
        'User-agent: *',
        'Allow: /login/',
        'Allow: /signup/',
        'Allow: /password/forgot/',
        # private paths — no reason for a crawler to
        # index
        'Disallow: /password/reset/',
        'Disallow: /home/',
        'Disallow: /_admin/',
        '',
        f'Sitemap: {base}/sitemap.xml',
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')


# --- GEO: llms.txt -----------------------------------------------------
# Emerging convention (no formal standard yet, but adopted by a growing
# number of sites for briefing AI answer engines 
@cache_control(max_age=86400)
def llms_txt(request):
    body = (
        f'# {static.project_name}\n\n'
        f'> {static.project_description}\n\n'
        'HttpChat is a web-based chat application. This section of the site '
        'handles account access: creating an account, logging in, and '
        'recovering a forgotten password via either an emailed reset link '
        'or a set of personal security questions.\n\n'
        '## Pages\n'
        f'- Sign up: {static.project_base_url}signup/\n'
        f'- Log in: {static.project_base_url}login/\n'
        f'- Forgot password: {static.project_base_url}password/forgot/\n'
    )
    return HttpResponse(body, content_type='text/plain; charset=utf-8')


urlpatterns = [
    path('_admin/', admin.site.urls),

    # --- SEO / GEO ---
    path('robots.txt', robots_txt, name='robots_txt'),
    path('llms.txt', llms_txt, name='llms_txt'),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),

    path('', include('Account.urls')),  #   On update, remember to update the canonicals in each pages
]
