import re
from urllib.parse import urljoin, urlparse

import httpx
from anthropic import Anthropic
from bs4 import BeautifulSoup
from pydantic import BaseModel


class ExtractedWebsiteData(BaseModel):
    name: str
    description: str
    services: list[str]
    location: str
    phone: str
    email: str


async def extract_website_details(url: str) -> ExtractedWebsiteData:
    """
    Extract business details from a website using BeautifulSoup + Claude AI.
    1. Try semantic HTML extraction first
    2. If insufficient, use Claude to intelligently extract from page content
    """
    # Validate and normalize URL
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    try:
        urlparse(url)
    except Exception as e:
        raise ValueError(f"Invalid URL: {str(e)}")

    # Fetch the website
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        html_content = response.text

    # Parse with BeautifulSoup
    soup = BeautifulSoup(html_content, "html.parser")

    # Extract semantic data
    extracted = _extract_from_html(soup, url)

    # If extraction is incomplete, use Claude for intelligent extraction
    if not extracted.get("name") or not extracted.get("description"):
        extracted = await _extract_with_claude(html_content, url, extracted)

    # Validate we have minimum required data
    if not extracted.get("name"):
        raise ValueError("Could not extract business name from website")

    return ExtractedWebsiteData(
        name=extracted.get("name", ""),
        description=extracted.get("description", ""),
        services=extracted.get("services", []),
        location=extracted.get("location", ""),
        phone=extracted.get("phone", ""),
        email=extracted.get("email", ""),
    )


def _extract_from_html(soup: BeautifulSoup, url: str) -> dict:
    """Extract business details using semantic HTML parsing."""
    extracted = {
        "name": "",
        "description": "",
        "services": [],
        "location": "",
        "phone": "",
        "email": "",
    }

    # Try to extract business name from common locations
    extracted["name"] = _get_business_name(soup)

    # Extract description
    extracted["description"] = _get_description(soup)

    # Extract contact info
    extracted["phone"] = _extract_phone(soup)
    extracted["email"] = _extract_email(soup)

    # Extract location
    extracted["location"] = _extract_location(soup)

    # Extract services/menu items
    extracted["services"] = _extract_services(soup)

    return extracted


def _get_business_name(soup: BeautifulSoup) -> str:
    """Extract business name from common HTML patterns."""
    # Try meta og:site_name
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        return og_site["content"].strip()

    # Try title tag
    title = soup.find("title")
    if title and title.string:
        name = title.string.strip()
        # Clean up typical title suffixes
        name = re.sub(r"\s*[-|]\s*(Home|Welcome|Site).*", "", name)
        if len(name) > 5:
            return name

    # Try h1
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        return h1.get_text(strip=True)[:100]

    return ""


def _get_description(soup: BeautifulSoup) -> str:
    """Extract business description from meta or content."""
    # Try meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        return meta_desc["content"].strip()

    # Try og:description
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        return og_desc["content"].strip()

    # Try first paragraph with meaningful content
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if len(text) > 50:
            return text[:500]

    return ""


def _extract_phone(soup: BeautifulSoup) -> str:
    """Extract phone number from HTML."""
    # Look for tel: links
    tel_links = soup.find_all("a", href=re.compile(r"^tel:"))
    if tel_links:
        phone = tel_links[0]["href"].replace("tel:", "").strip()
        return phone

    # Search for phone number patterns in text
    text = soup.get_text()
    phone_pattern = r"\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})"
    match = re.search(phone_pattern, text)
    if match:
        return f"({match.group(1)}) {match.group(2)}-{match.group(3)}"

    return ""


def _extract_email(soup: BeautifulSoup) -> str:
    """Extract email from HTML."""
    # Look for mailto: links
    mailto_links = soup.find_all("a", href=re.compile(r"^mailto:"))
    if mailto_links:
        email = mailto_links[0]["href"].replace("mailto:", "").strip()
        return email

    # Search for email pattern in text
    text = soup.get_text()
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    match = re.search(email_pattern, text)
    if match:
        return match.group(0)

    return ""


def _extract_location(soup: BeautifulSoup) -> str:
    """Extract location/address from HTML."""
    # Look for address tag
    address = soup.find("address")
    if address:
        return address.get_text(strip=True)[:200]

    # Look for schema.org structured data
    # (simplified — real implementation would parse JSON-LD)
    address_elements = soup.find_all(["span", "div"], {"class": re.compile(r"address|location", re.I)})
    for elem in address_elements:
        text = elem.get_text(strip=True)
        if len(text) > 10:
            return text[:200]

    return ""


def _extract_services(soup: BeautifulSoup) -> list[str]:
    """Extract services/menu items from HTML."""
    services = []

    # Look for common service/product sections
    for section in soup.find_all(["ul", "ol", "div"], {"class": re.compile(r"menu|service|product", re.I)}):
        for li in section.find_all("li")[:10]:
            text = li.get_text(strip=True)
            if text and len(text) > 3:
                services.append(text)

    # Look for heading-based services
    if not services:
        for h2 in soup.find_all("h2")[:5]:
            text = h2.get_text(strip=True)
            if text and len(text) > 3 and len(text) < 100:
                services.append(text)

    return services[:10]  # Limit to 10 services


async def _extract_with_claude(html_content: str, url: str, existing_data: dict) -> dict:
    """Use Claude API to intelligently extract missing business details."""
    from app.config import get_settings

    settings = get_settings()
    if not settings.anthropic_api_key:
        return existing_data  # Return what we have if no Claude API key

    client = Anthropic(api_key=settings.anthropic_api_key)

    # Prepare text content from HTML (strip HTML tags)
    soup = BeautifulSoup(html_content, "html.parser")
    text_content = soup.get_text(separator="\n", strip=True)[:4000]

    prompt = f"""Extract business information from this website content. Return ONLY a JSON object with these fields:
- name: Business name (string, required)
- description: Short business description (string, max 200 chars)
- services: List of main services/products offered (array of strings, max 10 items)
- location: Physical address or location (string, max 200 chars)
- phone: Contact phone number (string)
- email: Contact email (string)

Current extracted data: {existing_data}

Website URL: {url}

Website content:
{text_content}

Return ONLY valid JSON, no markdown formatting."""

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text
        extracted = eval(response_text)  # Parse JSON

        # Merge with existing data, preferring Claude extraction for missing fields
        for key in existing_data:
            if key in extracted and (not existing_data[key] or extracted[key]):
                existing_data[key] = extracted[key]

        return existing_data
    except Exception:
        return existing_data  # Return existing data if Claude extraction fails
