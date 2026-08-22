"""
Account/sitemaps.py
---------------------------------------------------------------------
Standard django.contrib.sitemaps setup. Only lists pages that are
genuinely public and worth a search engine indexing
"""
from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticAccountViewSitemap(Sitemap):
    changefreq = 'monthly'
    protocol = 'https'

    def items(self):
        # Each entry is (url_name, priority) — keeps per-page priority tunable without a second data structure.
        return [
            ('landing', 1.0),
            ('account_signup', 0.9),
            ('account_login', 0.8),
            ('account_forgot_password', 0.3),
            ('account_forgot_username', 0.3),
        ]

    def location(self, item):
        url_name, _priority = item
        return reverse(url_name)

    def priority(self, item):
        _url_name, priority = item
        return priority
