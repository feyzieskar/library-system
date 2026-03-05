FROM php:8.2-apache

# Fix MPM conflict: disable event, enable prefork (required for PHP)
RUN a2dismod mpm_event && a2enmod mpm_prefork && a2enmod rewrite

# Install MySQL PDO driver
RUN docker-php-ext-install pdo pdo_mysql

# Set document root
ENV APACHE_DOCUMENT_ROOT=/var/www/html
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Allow .htaccess override
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Copy project files
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port (Railway uses PORT env variable)
EXPOSE 80

# Use PORT environment variable if set (for Railway)
CMD sed -i "s/80/${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf && apache2-foreground
