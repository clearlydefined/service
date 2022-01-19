# How ClearlyDefined determines the declared license

## Crawler
* OSS components are harvested by the [ClearlyDefined Crawler](https://github.com/clearlydefined/crawler)
* The Crawler uses 3 tools for harvest - ClearlyDefined itself, [Scancode](https://scancode-toolkit.readthedocs.io/en/latest/getting-started/home.html), and [Licensee](https://github.com/licensee/licensee)
* See below for how it handles different types of components
* The Crawler then sends the harvest data to the ClearlyDefined Service

## Service
* The harvests are processed into definitions by the [ClearlyDefined Service](https://github.com/clearlydefined/service/tree/9e0a677a74c36c6ea276c4548b520b7c91db05ce)
* The service summarizes the data using the ClearlyDefined summarizer, Scancode summarizer, and Licensee summarizer
* The ClearlyDefined summarizer does different things based on the component type, see below for how it handles different types of components
* The Scancode summarizer pulls any declared license information detected by Scancode (for more information, see the [code here](https://github.com/clearlydefined/service/blob/2d1e52caf5c07c3b6ef2565b5b77f1b677c82033/providers/summary/scancode.js)
* The Licensee summarizer pulls any declared license information detected by Licensee (form more information, see the [code here](https://github.com/clearlydefined/service/blob/master/providers/summary/licensee.js)
* Then the ClearlyDefined service aggregates the information from the three tools - when there is conflicting information, the order of precedence is 'clearlydefined', 'licensee', 'scancode', 'cdsource'

## Curations
* If the declared license is changed through [the human curation process](https://github.com/clearlydefined/clearlydefined/blob/master/docs/curation-guidelines.md), the declared license in the curation will take precedence.

## Harvesting and Determining Declared License (by the ClearlyDefined Summarizer)

### npm
* source: https://www.npmjs.com
* The crawler pulls registry data for the component from https://registry.npmjs.com
* In the service, the ClearlyDefined summarizer parses license(s) from the registry data and sets them as the declared license

### gem
* source: https://rubygems.org
* The crawler pulls registry data for the component from https://rubygems.org
* The ClearlyDefined summarizer determines the declared license based on the license in the registry data

### pypi
* source: https://pypi.org
* First, the crawler pulls registry information from https://pypi.org [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/pypiFetch.js#L42)
* It then extracts the declared license from the registry data [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/pypiFetch.js#L71)
* The service uses the declared license set by the crawler

### maven
* sources https://mvnrepository.com/repos/central and https://maven.google.com/

**maven central**

* The crawler downloads the maven artifact from maven.org
* The crawler then extracts all pom files from the artifact
* And then merges the poms (including all the licenses defined in the poms)
* The ClearlyDefined summarizer parses the merged poms and sets the declared license(s) based on that data

**google maven**

* The crawler gets pom files for the component from https://dl.google.com/android/maven2/
* It then merges the poms (including all the licenses defined in the poms)
* The ClearlyDefined summarizer parses the merged poms and sets the declared license(s) based on that data

### nuget
* source: https://www.nuget.org/
* The crawler gets registry information for the component from https://api.nuget.org
* If the registry information has a licenseExpression field, the ClearlyDefined summarizer sets the declared license to that license expression
* If the registry information has a licenseUrl field, the ClearlyDefined summarizer extracts the license from that license url and sets the declared license to the extracted license
* If the ClearlyDefined summarizer cannot extract the license from the license URL, it sets the declared license to NOASSERTION

**Checking for the packageEntries field**

* The ClearlyDefined summarizer then checks whether the registry information has a packageEntries field
* If it does not, it leaves the declared license as it is
* If it does have a packageEntries field, the ClearlyDefined summarizer creates a new definition with the files field set to those packageEntries

**Merging definitions**

* It then merges the definitions and, in the process, merges the declared licenses
* If the original definition (prior to the merge) has a declared license of 'OTHER', it sets the declared license (on the merged definition) to the license on the new definition 
* Otherwise, it combines the original definition license and the new definition license with AND

### git
* sources: https://github.com and https://gitlab.com
* The crawler clones the repo for the component from either https://gitlab.com or https://github.com
* TODO - how is the declared license decided?

### crate
* source: https://crates.io/
* The crawler gets registry information from https://crates.io/api/v1/crates/
* The ClearlyDefined summarizer sets the declared license to the license(s) in the registry information

### deb
* source: http://ftp.debian.org/
* First, the crawler downloads a package file map from http://ftp.debian.org/debian/indices/package-file.map.bz2 and caches it (if there is not one already cached) for 8 hours [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/debianFetch.js#L87)
* It then pulls the registry information for the particular component from that package map file [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/debianFetch.js#L114)
* It then finds the relevant copyright URL from the registry information [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/debianFetch.js#L295) [Example](https://metadata.ftp-master.debian.org/changelogs/main/0/0ad-data/0ad-data_0.0.17-1_copyright)
* It then pulls information from the copyright URL [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/debianFetch.js#L306)
* And parses that information [Code](https://github.com/clearlydefined/crawler/blob/f461b2358fbde130bcc5d183de01a4212c4cd66d/providers/fetch/debianFetch.js#L320) to determine the declared license(s)
* The ClearlyDefined summarizer then parses the declared licenses and, if there is more than one, joins them with 'AND'

### debsrc
* source: http://ftp.debian.org/
* Appears to be the same as `deb`

### composer
* source: https://packagist.org/
* The crawler pulls registry information from https://repo.packagist.org/
* The ClearlyDefined summarizer then sets the declared license based on the registry information

### pod
* source: https://cocoapods.org/
* The service then sets the declared license based on the registry information
* The ClearlyDefined summarizer pulls registry information from 'https://raw.githubusercontent.com/CocoaPods/Specs/master
