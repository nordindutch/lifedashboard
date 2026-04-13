FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite \
    && apt-get purge -y libsqlite3-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite \
    && a2enmod env

COPY docker/php/apache-vhost.conf /etc/apache2/sites-available/000-default.conf

COPY docker/php/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip Windows CRLF so the shebang is valid inside Linux (fixes "no such file or directory").
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /var/www/html

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
